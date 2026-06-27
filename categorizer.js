/* categorizer.js — Transaction categorization for Nordea spending tracker
   Categories match the agreed clean structure from the spending analysis.
*/

const Categorizer = (() => {

  // ── Category definitions ────────────────────────────────────────────────
  const CATEGORIES = {
    housing: {
      label: 'Student housing',
      group: 'fixed',
      color: '#3a7abf',
      keywords: ['YUGO', 'UNINEST', 'HIGHFIELD', 'UNINESTSTUDENTS', 'UNIINEST'],
    },
    gym: {
      label: 'Gym · SATS',
      group: 'fixed',
      color: '#2b6ca3',
      keywords: ['SATS FINLAND', 'SATS'],
    },
    sok: {
      label: 'SOK (Prisma/S-Market)',
      group: 'groceries',
      color: '#1a8a68',
      keywords: ['PRISMA', 'S-MARKET', 'S-MARKE', 'ALEPA', 'S MARKET'],
    },
    kesko: {
      label: 'Kesko (K-stores)',
      group: 'groceries',
      color: '#3a7abf',
      keywords: ['K-SUPERMARKET', 'K-MARKET', 'K-CITYMARKET', 'KSUPERMARKET', 'K SUPERMARKET', 'K MARKET', 'K CITYMARKET', 'KAIVOPUISTO', 'ESPLANADI', 'ARABIA', 'TRIPLA K-', 'K-SUPER', 'EROTTAJA', 'ROBA'],
    },
    lidl: {
      label: 'Lidl',
      group: 'groceries',
      color: '#c04a42',
      keywords: ['LIDL'],
    },
    grocOther: {
      label: 'Other grocery',
      group: 'groceries',
      color: '#6b7e5a',
      keywords: ['COMPASS GROUP', 'COMPASS', 'ALKO', 'SUPERALKO', 'TOKMANNI', 'RIMI', 'UUDENMAAN HERKK', 'LIHATUKKU', 'VEIJO', 'RUSTA'],
    },
    travel: {
      label: 'Travel',
      group: 'variable',
      color: '#7c6fd4',
      keywords: ['FINNAIR', 'FINAVIA', 'SCANDIC', 'VR LIPPU', 'TALLINK', 'CITYBOX', 'COMFORT HOTEL', 'LENTOASEMA', 'RVANTTA', 'CABONLINE', 'DELUXE-TAXI', 'DELUXE TAXI', 'TAXI', 'MANKKAAN TAKSI', 'MANKKAAN', 'AIRPORT', 'VUELING', 'NORWEGIAN', 'SAS ', 'EUROWINGS', 'IBERIA', 'RYAN AIR', 'RYANAIR', 'EASYJET'],
    },
    dining: {
      label: 'Dining & delivery',
      group: 'variable',
      color: '#c49a2a',
      keywords: ['WOLT', 'CHICAGO1933', 'CHICAGO 1933', 'FOTOGRAFISKA', 'LE GREC', 'RESTORAN', 'RESTAURANT', 'BISTROO', 'HASSAN ASSAFI', 'GAUCHO', 'SELECTA', 'KASTRUP LUCA', 'LUCA', 'RAEHARRA', 'YA KESKUSTA', 'SCANDIC VULKAN FNB', 'SCANDIC FNB', 'HMSHOSTINT', 'FOOD', 'CAFFE', 'CAFE', 'BISTRO', 'RAVINTOLA', 'KIOSKI'],
    },
    fashion: {
      label: 'Fashion',
      group: 'variable',
      color: '#c0436a',
      keywords: ['ZARA', 'ARMINA', 'HUGO BOSS', 'TOMMY HILFIGER', 'TOMMY', 'SAND OUTLET', 'SAND HELSINKI', 'NORMAL HELSINKI', 'NORMAL', 'NOTINO', 'H&M', 'MANGO'],
    },
    sports: {
      label: 'Sports & wellness',
      group: 'variable',
      color: '#22a87a',
      keywords: ['MURTSICENTER', 'ALLAS SEA', 'ALLAS', 'ELAMUSSPA', 'ELAMUS SPA', 'PUHDASPLUS'],
    },
    personalCare: {
      label: 'Personal care',
      group: 'variable',
      color: '#d4856a',
      keywords: ['APTEEKKI', 'KAARTIN APTEEKK', 'KAARTIN KAMPAAM', 'SALON DE NIRO', 'DE NIRO', 'KAMPAAM', 'PHARMACY'],
    },
    cityServices: {
      label: 'Helsinki city services',
      group: 'admin',
      color: '#8e5ba8',
      keywords: ['KAUPUNKIYMPÄRISTÖN', 'PTLHELSINGIN', 'PTL HELSINGIN', 'KAUPUNKI', 'KAUPUNKIY'],
    },
    dutyFree: {
      label: 'Duty free',
      group: 'admin',
      color: '#6e67c8',
      keywords: ['DUTY FREE', 'HEINEMANN', 'AVGAN', 'DUTY-FREE'],
    },
    oneOffs: {
      label: 'Notable one-offs',
      group: 'admin',
      color: '#b07820',
      keywords: ['GIGANTTI', 'VERKKOKAUPPA', 'LOVESPACE', 'TEMU', 'MYSTAR', 'POSTI', 'KUKKAKAUPPA', 'VANDAS', 'EMBASSY', 'SUDAMEPTEEK'],
    },
    runningCosts: {
      label: 'Running costs',
      group: 'admin',
      color: '#5a5a52',
      keywords: ['HSL MOBIILI', 'HSL', 'GOOGLE', 'THREE IRELAND', 'THREE IRELA', 'EUROPARK', 'EASYPARK', 'VOTINGPARTNER', 'VOTING', 'GOOGLE ONE'],
    },
  };

  // Group definitions for the P&L statement
  const GROUPS = {
    fixed:     { label: 'Fixed obligations', order: 0 },
    groceries: { label: 'Groceries',         order: 1 },
    variable:  { label: 'Variable spending', order: 2 },
    admin:     { label: 'Admin',             order: 3 },
  };

  // ── Categorize a single transaction ────────────────────────────────────
  function categorize(transaction) {
    const merchant = (transaction.merchant + ' ' + (transaction.rawMerchant || '')).toUpperCase();

    for (const [key, cat] of Object.entries(CATEGORIES)) {
      for (const kw of cat.keywords) {
        if (merchant.includes(kw.toUpperCase())) {
          return { ...transaction, category: key, categoryLabel: cat.label, categoryGroup: cat.group, categoryColor: cat.color };
        }
      }
    }

    // Fallback: try country-based hints
    if (transaction.country === 'IRL' || transaction.country === 'IE') {
      // Irish transactions that weren't caught
      return { ...transaction, category: 'oneOffs', categoryLabel: 'Notable one-offs', categoryGroup: 'admin', categoryColor: CATEGORIES.oneOffs.color };
    }

    return { ...transaction, category: 'runningCosts', categoryLabel: 'Running costs', categoryGroup: 'admin', categoryColor: CATEGORIES.runningCosts.color };
  }

  // ── Categorize all transactions in a statement ─────────────────────────
  function categorizeAll(statement) {
    return {
      ...statement,
      transactions: statement.transactions.map(categorize)
    };
  }

  // ── Aggregate transactions into category totals for a set of statements ─
  function aggregate(statements) {
    const months = statements.map(s => s.periodLabel);

    // Build per-month totals for each category
    const catTotals = {};
    Object.keys(CATEGORIES).forEach(key => {
      catTotals[key] = statements.map(() => 0);
    });

    statements.forEach((stmt, mi) => {
      stmt.transactions.forEach(tx => {
        if (tx.amount > 0 && tx.category && catTotals[tx.category] !== undefined) {
          catTotals[tx.category][mi] += tx.amount;
        }
      });
    });

    // Round values
    Object.keys(catTotals).forEach(key => {
      catTotals[key] = catTotals[key].map(v => Math.round(v));
    });

    // Compute monthly gross
    const monthlyGross = statements.map((_, mi) =>
      Object.values(catTotals).reduce((s, arr) => s + arr[mi], 0)
    );

    return { months, catTotals, monthlyGross, categories: CATEGORIES, groups: GROUPS };
  }

  // ── Get color for a category key ──────────────────────────────────────
  function color(key) {
    return CATEGORIES[key]?.color || '#6b6560';
  }

  function label(key) {
    return CATEGORIES[key]?.label || key;
  }

  return { categorize, categorizeAll, aggregate, color, label, CATEGORIES, GROUPS };
})();
