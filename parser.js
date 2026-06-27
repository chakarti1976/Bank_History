/* parser.js — Nordea PDF invoice parser
   Uses PDF.js to extract text, then applies Nordea-specific parsing logic.
   Handles both the old format (no cardholder name per tx) and new (June 2026+).
*/

const NordeaParser = (() => {

  // ── Extract all text lines from a PDF ArrayBuffer ─────────────────────
  async function extractLines(arrayBuffer) {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const allItems = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // Each item has .str (text) and .transform (matrix, position)
      // transform[5] = Y, transform[4] = X
      content.items.forEach(item => {
        if (item.str.trim()) {
          allItems.push({
            str: item.str.trim(),
            x: item.transform[4],
            y: item.transform[5],
            page: p
          });
        }
      });
    }

    // Sort: page asc, then Y desc (top of page first), then X asc
    allItems.sort((a, b) =>
      a.page !== b.page ? a.page - b.page :
      Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x
    );

    // Group items on the same Y-line
    const lines = [];
    let currentLine = [];
    let lastY = null;
    allItems.forEach(item => {
      if (lastY !== null && Math.abs(item.y - lastY) > 4) {
        if (currentLine.length) lines.push(currentLine.map(i => i.str).join(' '));
        currentLine = [];
      }
      currentLine.push(item);
      lastY = item.y;
    });
    if (currentLine.length) lines.push(currentLine.map(i => i.str).join(' '));

    return lines;
  }

  // ── Parse amount string "1.234,56" or "1234,56" → number ──────────────
  function parseAmount(str) {
    if (!str) return 0;
    // Remove thousands separator (.) then replace comma with dot
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
  }

  // ── Parse Finnish date "6.5.2026" → "2026-05-06" ─────────────────────
  function parseDate(str) {
    const m = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!m) return str;
    return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  }

  // ── Main parse function ────────────────────────────────────────────────
  async function parse(arrayBuffer, filename) {
    const lines = await extractLines(arrayBuffer);
    const text = lines.join('\n');

    // ── Extract invoice metadata ────────────────────────────────────────
    const periodMatch = text.match(/Invoicing period[:\s]+(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4})/);
    const invoiceDateMatch = text.match(/Invoice date[:\s]+(\d{1,2}\.\d{1,2}\.\d{4})/);
    const amountMatch = text.match(/Amount[:\s]+([\d,.]+)\s+EUR/);
    const balanceMatch = text.match(/Total Balance\s+([-\d,.]+)/);
    const dueDateMatch = text.match(/Due date[:\s]+(\d{1,2}\.\d{1,2}\.\d{4})/);

    const period = periodMatch
      ? `${parseDate(periodMatch[1])} – ${parseDate(periodMatch[2])}`
      : filename;

    const periodLabel = periodMatch
      ? formatPeriodLabel(periodMatch[1], periodMatch[2])
      : filename.replace('.pdf','');

    // ── Parse transactions ──────────────────────────────────────────────
    const transactions = [];
    const dateAmtPattern = /^(\d{1,2}\.\d{1,2}\.\d{4})\s+([-\d,.]+)\s+([-\d,.]+)/;
    const txStartPattern = /^522580-\*\*-\*\*\*\*-0698\s+(Retail|Credit)/i;
    const paymentPattern = /^01097841378\s+Payment\s+(\d{1,2}\.\d{1,2}\.\d{4})\s+([-\d,.]+)/i;
    const creditIntPattern = /^01097841378\s+Credit interest\s+(\d{1,2}\.\d{1,2}\.\d{4})\s+([-\d,.]+)/i;
    const cashbackPattern = /^522580-\*\*-\*\*\*\*-0698\s+Credit\s+FIN\s+Nordea\s+Cashback/i;

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Payment line
      if (paymentPattern.test(line)) {
        const m = line.match(paymentPattern);
        transactions.push({
          date: parseDate(m[1]),
          merchant: 'Payment',
          amount: parseAmount(m[2]),
          category: 'payment',
          type: 'payment'
        });
        i++;
        continue;
      }

      // Cashback credit
      if (cashbackPattern.test(line)) {
        // look for the date amount on next lines
        let j = i + 1;
        while (j < lines.length && !dateAmtPattern.test(lines[j]) && j < i + 8) j++;
        if (dateAmtPattern.test(lines[j])) {
          const m = lines[j].match(dateAmtPattern);
          transactions.push({
            date: parseDate(m[1]),
            merchant: 'Nordea Cashback',
            amount: parseAmount(m[2]),
            category: 'credit',
            type: 'credit'
          });
        }
        i = j + 1;
        continue;
      }

      // Retail/Credit transaction
      if (txStartPattern.test(line)) {
        const typeMatch = line.match(/(Retail|Credit)/i);
        const txType = typeMatch ? typeMatch[1].toLowerCase() : 'retail';
        const countryMatch = line.match(/\b([A-Z]{3})\s*$/);
        const country = countryMatch ? countryMatch[1] : '';

        // Collect merchant lines until we hit a date+amount line
        const merchantParts = [];
        let j = i + 1;
        const maxLook = Math.min(i + 10, lines.length);

        while (j < maxLook) {
          const l = lines[j];
          if (dateAmtPattern.test(l)) break;
          // Skip "Quantity invoiced", cardholder name, page headers
          if (!/Quantity invoiced|CHAKAROV TIHOMIR|Nordea Bank|INVOICE -|Page \d/i.test(l)) {
            merchantParts.push(l);
          }
          j++;
        }

        if (j < lines.length && dateAmtPattern.test(lines[j])) {
          const m = lines[j].match(dateAmtPattern);
          const rawMerchant = merchantParts
            .filter(p => p.length > 0)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          transactions.push({
            date: parseDate(m[1]),
            merchant: cleanMerchant(rawMerchant),
            rawMerchant: rawMerchant,
            amount: parseAmount(m[2]),
            country: country,
            category: null, // filled by categorizer
            type: txType
          });
        }
        i = j + 1;
        continue;
      }

      i++;
    }

    // Filter out zero-amount transactions
    const retail = transactions.filter(t => t.type !== 'payment' && t.type !== 'credit' && t.amount !== 0);
    const payments = transactions.filter(t => t.type === 'payment');
    const credits = transactions.filter(t => t.type === 'credit');

    const grossSpend = retail.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);

    return {
      filename,
      period,
      periodLabel,
      invoiceDate: invoiceDateMatch ? parseDate(invoiceDateMatch[1]) : null,
      dueDate: dueDateMatch ? parseDate(dueDateMatch[1]) : null,
      invoiceAmount: amountMatch ? parseAmount(amountMatch[1]) : 0,
      totalBalance: balanceMatch ? parseAmount(balanceMatch[1]) : 0,
      grossSpend: Math.round(grossSpend),
      transactions: retail,
      payments,
      credits,
      txCount: retail.length
    };
  }

  // ── Clean merchant name ────────────────────────────────────────────────
  function cleanMerchant(raw) {
    return raw
      .replace(/VFI/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s\-]+/, '')
      .trim()
      .slice(0, 60); // cap length
  }

  // ── Format period label e.g. "Jan–Feb 2026" ───────────────────────────
  function formatPeriodLabel(from, to) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const [,fm,fy] = from.match(/(\d{1,2})\.(\d{4})/) || from.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/) || [];
    const [,tm,ty] = to.match(/(\d{1,2})\.(\d{4})/) || to.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/) || [];

    // from "6.12.2025" → extract month/year
    const fromParts = from.split('.');
    const toParts = to.split('.');
    if (fromParts.length < 3 || toParts.length < 3) return `${from} – ${to}`;

    const fromMonth = months[parseInt(fromParts[1]) - 1];
    const toMonth   = months[parseInt(toParts[1]) - 1];
    const year      = toParts[2];

    return `${fromMonth}–${toMonth} ${year}`;
  }

  return { parse };
})();
