/* app.js — Main application for Nordea Spending Tracker
   Handles navigation, chart rendering, table building, file upload, and
   the animated financial background canvas.
*/

// ══════════════════════════════════════════════════════════════════════════
// ── ANIMATED BACKGROUND ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
(function initBackground() {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, points = [], lines = [];

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  // Generate a faint candlestick-like chart pattern
  function generateChart() {
    lines = [];
    const cols = Math.ceil(W / 40);
    let y = H * 0.5;
    for (let i = 0; i <= cols; i++) {
      const x = i * 40;
      const open  = y;
      const close = y + (Math.random() - 0.5) * 60;
      const high  = Math.min(open, close) - Math.random() * 20;
      const low   = Math.max(open, close) + Math.random() * 20;
      lines.push({ x, open, close, high, low });
      y = close;
    }
  }

  // Floating grid dots
  function generatePoints(n) {
    points = [];
    for (let i = 0; i < n; i++) {
      points.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        r: Math.random() * 1.2 + 0.3
      });
    }
  }

  let chartOffset = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Draw grid
    ctx.strokeStyle = 'rgba(201,168,76,0.04)';
    ctx.lineWidth = 1;
    const gridSize = 60;
    for (let x = 0; x < W; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Draw scrolling candlestick chart
    chartOffset = (chartOffset + 0.1) % 40;
    lines.forEach((c, idx) => {
      const x = c.x - chartOffset;
      const bull = c.close < c.open;
      const color = bull ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.10)';

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, c.high); ctx.lineTo(x, c.low);
      ctx.stroke();

      // Body
      ctx.fillStyle = color;
      const bodyH = Math.abs(c.close - c.open) || 2;
      ctx.fillRect(x - 5, Math.min(c.open, c.close), 10, bodyH);
    });

    // Draw moving price line
    ctx.strokeStyle = 'rgba(201,168,76,0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    lines.forEach((c, i) => {
      const x = c.x - chartOffset;
      if (i === 0) ctx.moveTo(x, c.close);
      else ctx.lineTo(x, c.close);
    });
    ctx.stroke();

    // Floating dots (nodes)
    points.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(201,168,76,0.25)';
      ctx.fill();
    });

    // Connect nearby dots
    ctx.strokeStyle = 'rgba(201,168,76,0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(points[i].x, points[i].y);
          ctx.lineTo(points[j].x, points[j].y);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(draw);
  }

  resize();
  generateChart();
  generatePoints(50);
  draw();
  window.addEventListener('resize', () => { resize(); generateChart(); generatePoints(50); });
})();


// ══════════════════════════════════════════════════════════════════════════
// ── CHART.JS DEFAULTS ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
Chart.defaults.color = '#7a7568';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = "'DM Mono', monospace";
Chart.defaults.font.size = 11;

const CHART_INSTANCES = {};

function destroyChart(id) {
  if (CHART_INSTANCES[id]) { CHART_INSTANCES[id].destroy(); delete CHART_INSTANCES[id]; }
}

// ══════════════════════════════════════════════════════════════════════════
// ── STATE ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
let allStatements = [];

// ══════════════════════════════════════════════════════════════════════════
// ── NAVIGATION ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
    if (btn.dataset.view === 'transactions') renderTransactions();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ── UPLOAD HANDLING ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
const uploadZone = document.getElementById('uploadZone');
const fileInput  = document.getElementById('fileInput');

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  processFiles(Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.pdf')));
});
fileInput.addEventListener('change', e => {
  processFiles(Array.from(e.target.files));
  fileInput.value = '';
});

async function processFiles(files) {
  if (!files.length) return;
  const statusEl = document.getElementById('parseStatus');
  statusEl.style.display = 'block';
  statusEl.innerHTML = '';

  for (const file of files) {
    statusEl.innerHTML += `<div class="working">⟳ Parsing ${file.name}…</div>`;
    try {
      const buf = await file.arrayBuffer();
      let stmt = await NordeaParser.parse(buf, file.name);
      stmt = Categorizer.categorizeAll(stmt);
      await Store.save(stmt);
      statusEl.innerHTML += `<div class="ok">✓ ${stmt.periodLabel} — ${stmt.txCount} transactions · €${stmt.grossSpend.toLocaleString()}</div>`;
    } catch (err) {
      statusEl.innerHTML += `<div class="err">✗ ${file.name} — ${err.message}</div>`;
      console.error(err);
    }
  }

  await refreshData();
}

// ══════════════════════════════════════════════════════════════════════════
// ── DATA REFRESH ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
async function refreshData() {
  allStatements = await Store.loadAll();
  renderStatementsList();
  renderDashboard();
  renderTransactions();
  updateHeader();
}

function updateHeader() {
  const meta = document.getElementById('headerMeta');
  if (!allStatements.length) { meta.textContent = 'No data yet'; return; }
  const last = allStatements[allStatements.length - 1];
  meta.textContent = `${allStatements.length} statements · Latest: ${last.periodLabel}`;
}

// ══════════════════════════════════════════════════════════════════════════
// ── STATEMENTS LIST ───────────────────────────────────────────────════════
// ══════════════════════════════════════════════════════════════════════════
function renderStatementsList() {
  const card = document.getElementById('statementsCard');
  const tbody = document.getElementById('statementsBody');
  if (!allStatements.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  tbody.innerHTML = allStatements.map(s => `
    <tr>
      <td>${s.periodLabel}</td>
      <td>${s.invoiceDate || '—'}</td>
      <td style="color:var(--text);font-family:var(--mono)">€${s.grossSpend.toLocaleString()}</td>
      <td style="color:var(--gold);font-family:var(--mono)">€${(s.totalBalance||0).toLocaleString('fi-FI',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td style="color:var(--text-dim)">${s.txCount}</td>
      <td><button class="btn-del" data-id="${s.id}">Delete</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this statement?')) {
        await Store.remove(Number(btn.dataset.id));
        await refreshData();
      }
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════
// ── DASHBOARD ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
function renderDashboard() {
  if (!allStatements.length) return;
  const agg = Categorizer.aggregate(allStatements);
  renderKPIs(agg);
  renderOverviewChart(agg);
  renderGroceryChart(agg);
  renderDonutChart(agg);
  renderTrendChart(agg);
  renderAdminChart(agg);
  renderPLTable(agg);
}

// ── KPIs ──────────────────────────────────────────────────────────────────
function renderKPIs(agg) {
  const n = agg.months.length;
  const totalSpend = agg.monthlyGross.reduce((s,v) => s+v, 0);
  const avgSpend   = Math.round(totalSpend / n);
  const latest     = agg.monthlyGross[n-1];
  const prev       = n > 1 ? agg.monthlyGross[n-2] : null;
  const change     = prev ? Math.round((latest - prev) / prev * 100) : null;
  const balance    = allStatements[n-1]?.totalBalance || 0;
  const dueDate    = allStatements[n-1]?.dueDate || '';

  const kpis = [
    { label: 'Total spend', value: `€${totalSpend.toLocaleString()}`, sub: `${n} months`, cls: '' },
    { label: 'Monthly avg',  value: `€${avgSpend.toLocaleString()}`,    sub: 'per period', cls: '' },
    { label: 'Latest month', value: `€${latest.toLocaleString()}`,
      sub: change !== null ? `${change >= 0 ? '+' : ''}${change}% vs prior` : agg.months[n-1],
      cls: change !== null ? (change < 0 ? 'green' : 'red') : '' },
    { label: 'Balance due',  value: `€${balance.toLocaleString('fi-FI',{minimumFractionDigits:2})}`,
      sub: dueDate ? `Due ${dueDate}` : '', cls: balance > 0 ? 'red' : 'green' }
  ];

  const row = document.getElementById('kpiRow');
  row.innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="kpi-inner">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value ${k.cls}">${k.value}</div>
        ${k.sub ? `<div class="kpi-sub">${k.sub}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// ── OVERVIEW STACKED BAR ──────────────────────────────────────────────────
function renderOverviewChart(agg) {
  destroyChart('overview');
  const groups = [
    { keys: ['housing','gym'], label: 'Fixed',              color: '#3a7abf' },
    { keys: ['sok','kesko','lidl','grocOther'], label: 'Groceries', color: '#4a9c35' },
    { keys: ['travel'],        label: 'Travel',             color: '#7c6fd4' },
    { keys: ['dining'],        label: 'Dining',             color: '#c49a2a' },
    { keys: ['fashion'],       label: 'Fashion',            color: '#c0436a' },
    { keys: ['sports','personalCare'], label: 'Health & care', color: '#22a87a' },
    { keys: ['cityServices','dutyFree'], label: 'City & duty free', color: '#8e5ba8' },
    { keys: ['oneOffs','runningCosts'], label: 'One-offs & running', color: '#6b6560' },
  ];

  const datasets = groups.map(g => ({
    label: g.label,
    data: agg.months.map((_, i) => g.keys.reduce((s, k) => s + (agg.catTotals[k]?.[i] || 0), 0)),
    backgroundColor: g.color,
    borderWidth: 0,
  }));

  // Build legend
  const legendEl = document.getElementById('overviewLegend');
  legendEl.innerHTML = groups.map(g =>
    `<div class="legend-item"><div class="legend-swatch" style="background:${g.color}"></div>${g.label}</div>`
  ).join('');

  CHART_INSTANCES.overview = new Chart(document.getElementById('overviewChart'), {
    type: 'bar',
    data: { labels: agg.months, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          label: c => ` ${c.dataset.label}: €${c.raw.toLocaleString()}`,
          footer: items => `Total: €${items.reduce((s,i)=>s+i.raw,0).toLocaleString()}`
        }}
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: '#7a7568' } },
        y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#7a7568', callback: v => '€'+v.toLocaleString() } }
      }
    }
  });
}

// ── GROCERY CHAIN BAR ─────────────────────────────────────────────────────
function renderGroceryChart(agg) {
  destroyChart('groc');
  const sets = [
    { key: 'sok',       label: 'SOK',    color: '#1a8a68' },
    { key: 'kesko',     label: 'Kesko',  color: '#3a7abf' },
    { key: 'lidl',      label: 'Lidl',   color: '#c04a42' },
    { key: 'grocOther', label: 'Other',  color: '#6b6560' },
  ];
  CHART_INSTANCES.groc = new Chart(document.getElementById('grocChart'), {
    type: 'bar',
    data: {
      labels: agg.months,
      datasets: sets.map(s => ({ label: s.label, data: agg.catTotals[s.key] || [], backgroundColor: s.color, borderWidth: 0 }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#7a7568', boxWidth: 10, padding: 10 } }, tooltip: { callbacks: { footer: items => `Total: €${items.reduce((s,i)=>s+i.raw,0).toLocaleString()}` } } },
      scales: { x: { stacked: true, grid: { display: false }, ticks: { color: '#7a7568' } }, y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#7a7568', callback: v => '€'+v } } }
    }
  });
}

// ── CATEGORY DONUT ────────────────────────────────────────────────────────
function renderDonutChart(agg) {
  destroyChart('donut');
  const groups = [
    { keys: ['housing','gym'], label: 'Fixed',    color: '#3a7abf' },
    { keys: ['sok','kesko','lidl','grocOther'], label: 'Groceries', color: '#4a9c35' },
    { keys: ['travel'],  label: 'Travel',   color: '#7c6fd4' },
    { keys: ['dining'],  label: 'Dining',   color: '#c49a2a' },
    { keys: ['fashion'], label: 'Fashion',  color: '#c0436a' },
    { keys: ['sports','personalCare'], label: 'Health', color: '#22a87a' },
    { keys: ['cityServices','dutyFree','oneOffs','runningCosts'], label: 'Admin & misc', color: '#8e5ba8' },
  ];

  const totals = groups.map(g => g.keys.reduce((s, k) => s + (agg.catTotals[k] || []).reduce((a,b)=>a+b,0), 0));

  CHART_INSTANCES.donut = new Chart(document.getElementById('donutChart'), {
    type: 'doughnut',
    data: {
      labels: groups.map(g => g.label),
      datasets: [{ data: totals, backgroundColor: groups.map(g => g.color), borderWidth: 0, hoverOffset: 8 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: {
        legend: { position: 'right', labels: { color: '#7a7568', boxWidth: 10, padding: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ` ${c.label}: €${c.raw.toLocaleString()}` } }
      }
    }
  });
}

// ── TREND LINES ───────────────────────────────────────────────────────────
function renderTrendChart(agg) {
  destroyChart('trend');
  const grocData = agg.months.map((_, i) => ['sok','kesko','lidl','grocOther'].reduce((s,k) => s+(agg.catTotals[k]?.[i]||0), 0));
  const sets = [
    { label: 'Groceries', data: grocData, color: '#4a9c35', fill: true },
    { label: 'Travel',    data: agg.catTotals.travel || [], color: '#7c6fd4', fill: false },
    { label: 'Dining',    data: agg.catTotals.dining || [], color: '#c49a2a', fill: false },
    { label: 'Fashion',   data: agg.catTotals.fashion|| [], color: '#c0436a', fill: false },
  ];
  CHART_INSTANCES.trend = new Chart(document.getElementById('trendChart'), {
    type: 'line',
    data: {
      labels: agg.months,
      datasets: sets.map(s => ({ label: s.label, data: s.data, borderColor: s.color, backgroundColor: s.fill ? s.color+'22' : 'transparent', tension: 0.35, pointRadius: 4, fill: s.fill, borderWidth: 2 }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#7a7568', boxWidth: 10, padding: 10 } }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: €${c.raw}` } } },
      scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7a7568' } }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7a7568', callback: v => '€'+v } } }
    }
  });
}

// ── ADMIN BREAKDOWN ───────────────────────────────────────────────────────
function renderAdminChart(agg) {
  destroyChart('admin');
  const sets = [
    { key: 'cityServices', label: 'City services', color: '#8e5ba8' },
    { key: 'dutyFree',     label: 'Duty free',     color: '#7c6fd4' },
    { key: 'oneOffs',      label: 'One-offs',      color: '#c49a2a' },
    { key: 'runningCosts', label: 'Running',       color: '#6b6560' },
  ];
  CHART_INSTANCES.admin = new Chart(document.getElementById('adminChart'), {
    type: 'bar',
    data: {
      labels: agg.months,
      datasets: sets.map(s => ({ label: s.label, data: agg.catTotals[s.key]||[], backgroundColor: s.color, borderWidth: 0 }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#7a7568', boxWidth: 10, padding: 10 } }, tooltip: { callbacks: { footer: items => `Total: €${items.reduce((s,i)=>s+i.raw,0).toLocaleString()}` } } },
      scales: { x: { stacked: true, grid: { display: false }, ticks: { color: '#7a7568' } }, y: { stacked: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7a7568', callback: v => '€'+v } } }
    }
  });
}

// ── P&L TABLE ─────────────────────────────────────────────────────────────
function renderPLTable(agg) {
  const n = agg.months.length;
  const gt = agg.monthlyGross.reduce((s,v)=>s+v,0);
  function row(label, arr, cls, indent) {
    const t = arr.reduce((s,v)=>s+v,0);
    const cells = arr.map(v => `<td class="${cls||''}">${v===0?'<span class="dim">—</span>':v.toLocaleString()}</td>`).join('');
    const labelCell = indent
      ? `<td style="padding-left:18px;font-size:11px;color:var(--text-dim)">↳ ${label}</td>`
      : `<td>${label}</td>`;
    return `<tr class="${cls||''}">${labelCell}${cells}<td class="${cls||''}">${t.toLocaleString()}</td><td style="font-size:10px;color:var(--text-dim)">${(t/gt*100).toFixed(1)}%</td></tr>`;
  }
  function secHdr(label) {
    return `<tr class="sec-hdr"><td colspan="${n+3}">${label}</td></tr>`;
  }
  function stRow(label, arr) {
    const t = arr.reduce((s,v)=>s+v,0);
    return `<tr class="subtotal"><td>${label}</td>${arr.map(v=>`<td>${v.toLocaleString()}</td>`).join('')}<td>${t.toLocaleString()}</td><td></td></tr>`;
  }
  function totRow(label, arr) {
    const t = arr.reduce((s,v)=>s+v,0);
    return `<tr class="total-row"><td>${label}</td>${arr.map(v=>`<td>${v.toLocaleString()}</td>`).join('')}<td>${t.toLocaleString()}</td><td></td></tr>`;
  }
  function momRow() {
    const labels = agg.months.map((_, i) => {
      if (i === 0) return 'base';
      const pct = Math.round((agg.monthlyGross[i] - agg.monthlyGross[i-1]) / agg.monthlyGross[i-1] * 100);
      return `<span class="${pct>=0?'red':'green'}">${pct>=0?'+':''}${pct}%</span>`;
    });
    return `<tr class="mom-row"><td>Month-on-month</td>${labels.map(l=>`<td>${l}</td>`).join('')}<td colspan="2"></td></tr>`;
  }

  const C = agg.catTotals;
  const getArr = key => C[key] || agg.months.map(()=>0);
  const sumKeys = keys => agg.months.map((_,i) => keys.reduce((s,k) => s+(C[k]?.[i]||0),0));
  const fixedArr = sumKeys(['housing','gym']);
  const grocArr  = sumKeys(['sok','kesko','lidl','grocOther']);

  const thead = `<thead><tr>
    <th style="text-align:left">Category</th>
    ${agg.months.map(m=>`<th>${m}</th>`).join('')}
    <th>Total</th><th>%</th>
  </tr></thead>`;

  let html = thead + '<tbody>';
  html += secHdr('Fixed obligations');
  html += row('Student housing · Dublin', getArr('housing'), '', false);
  html += row('Gym · SATS', getArr('gym'), '', false);
  html += stRow('Fixed total', fixedArr);

  html += secHdr('Groceries');
  html += row('SOK (Prisma + S-Market)', getArr('sok'), 'sub-row', true);
  html += row('Kesko (K-stores)', getArr('kesko'), 'sub-row', true);
  html += row('Lidl', getArr('lidl'), 'sub-row', true);
  html += row('Other (canteen · Alko · Tokmanni)', getArr('grocOther'), 'sub-row', true);
  html += stRow('Groceries total', grocArr);

  html += secHdr('Variable spending');
  html += row('Travel', getArr('travel'), '', false);
  html += row('Dining out & delivery', getArr('dining'), '', false);
  html += row('Fashion & clothing', getArr('fashion'), '', false);
  html += row('Sports & wellness', getArr('sports'), '', false);
  html += row('Personal care', getArr('personalCare'), '', false);

  html += secHdr('Admin — clean structure');
  html += row('Helsinki city services', getArr('cityServices'), 'gold', false);
  html += row('Duty free', getArr('dutyFree'), 'gold', false);
  html += row('Notable one-offs', getArr('oneOffs'), 'gold', false);
  html += row('Running costs', getArr('runningCosts'), '', false);

  html += totRow('Gross spending', agg.monthlyGross);
  html += momRow();
  html += '</tbody>';

  document.getElementById('plTable').innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════════
// ── TRANSACTIONS VIEW ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
function renderTransactions() {
  if (!allStatements.length) return;

  // Populate filter dropdowns
  const monthSel = document.getElementById('filterMonth');
  const catSel   = document.getElementById('filterCat');

  monthSel.innerHTML = '<option value="">All periods</option>' +
    allStatements.map(s => `<option value="${s.period}">${s.periodLabel}</option>`).join('');

  const catKeys = [...new Set(allStatements.flatMap(s => s.transactions.map(t => t.category)).filter(Boolean))];
  catSel.innerHTML = '<option value="">All categories</option>' +
    catKeys.map(k => `<option value="${k}">${Categorizer.label(k)}</option>`).join('');

  function filterAndRender() {
    const mFilter = monthSel.value;
    const cFilter = catSel.value;
    const search  = document.getElementById('filterSearch').value.toLowerCase();

    let txs = allStatements.flatMap(s =>
      s.transactions.map(t => ({ ...t, period: s.period, periodLabel: s.periodLabel }))
    );

    if (mFilter) txs = txs.filter(t => t.period === mFilter);
    if (cFilter) txs = txs.filter(t => t.category === cFilter);
    if (search)  txs = txs.filter(t => t.merchant.toLowerCase().includes(search));

    txs.sort((a,b) => b.date.localeCompare(a.date));

    document.getElementById('txCount').textContent = `${txs.length} transactions`;
    document.getElementById('txBody').innerHTML = txs.length ? txs.map(t => {
      const color = Categorizer.color(t.category);
      const isNeg = t.amount < 0;
      return `<tr>
        <td>${t.date}</td>
        <td style="text-align:left;max-width:220px;overflow:hidden;text-overflow:ellipsis">${t.merchant}</td>
        <td style="text-align:left"><span class="cat-badge" style="background:${color}22;color:${color}">${Categorizer.label(t.category)}</span></td>
        <td style="text-align:left;color:var(--text-dim);font-size:11px">${t.country||''}</td>
        <td class="num ${isNeg?'green':''}">€${Math.abs(t.amount).toLocaleString('fi-FI',{minimumFractionDigits:2})}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="5" class="empty-msg">No transactions match</td></tr>';
  }

  document.getElementById('filterMonth').addEventListener('change', filterAndRender);
  document.getElementById('filterCat').addEventListener('change', filterAndRender);
  document.getElementById('filterSearch').addEventListener('input', filterAndRender);
  filterAndRender();
}

// ══════════════════════════════════════════════════════════════════════════
// ── INIT ──────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
(async () => {
  await refreshData();
})();
