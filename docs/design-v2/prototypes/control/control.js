/* global document, window, location, URLSearchParams, FormData, setTimeout, clearTimeout */
/* Round 02. This prototype contains no API requests or persistent business data. */
'use strict';
const root = document.getElementById('root');
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const icon = (name) => window.prototypeIcons[name] || '';
const money = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    value,
  );
const products = [
  {
    id: 1,
    sku: 'HP-1001',
    name: 'Padded Mailer Medium',
    unit: 'each',
    onHand: 180,
    reserved: 20,
    min: 30,
    price: 2.5,
  },
  {
    id: 2,
    sku: 'HP-1002',
    name: 'Kraft Carton Large',
    unit: 'each',
    onHand: 12,
    reserved: 0,
    min: 12,
    price: 7.75,
  },
  {
    id: 3,
    sku: 'HP-1003',
    name: 'Thermal Labels 4×6',
    unit: 'roll',
    onHand: 8,
    reserved: 0,
    min: 10,
    price: 12,
  },
  {
    id: 4,
    sku: 'HP-1004',
    name: 'Packing Tape Clear',
    unit: 'roll',
    onHand: 64,
    reserved: 0,
    min: 20,
    price: 3.25,
  },
  {
    id: 5,
    sku: 'HP-1005',
    name: 'Bubble Wrap Roll',
    unit: 'roll',
    onHand: 35,
    reserved: 0,
    min: 10,
    price: 15,
  },
  {
    id: 6,
    sku: 'HP-1006',
    name: 'Stretch Film',
    unit: 'roll',
    onHand: 48,
    reserved: 0,
    min: 12,
    price: 18.5,
  },
  {
    id: 7,
    sku: 'HP-1007',
    name: 'Shipping Pouch A4',
    unit: 'pack',
    onHand: 90,
    reserved: 0,
    min: 20,
    price: 6.5,
  },
  {
    id: 8,
    sku: 'HP-1008',
    name: 'Fragile Stickers',
    unit: 'pack',
    onHand: 56,
    reserved: 0,
    min: 15,
    price: 4.25,
  },
];
const orders = [
  {
    id: 1002,
    customer: 'Cedar Street Market',
    status: 'Draft',
    date: 'Oct 17',
    lines: [
      { product: 2, qty: 3 },
      { product: 3, qty: 2 },
    ],
  },
  {
    id: 1001,
    customer: 'Northstar Office Supply',
    status: 'Draft',
    date: 'Oct 17',
    lines: [{ product: 1, qty: 10 }],
  },
  {
    id: 1003,
    customer: 'Bluebird Hospitality',
    status: 'Confirmed',
    date: 'Oct 18',
    lines: [{ product: 1, qty: 20 }],
  },
  {
    id: 1005,
    customer: 'Goodship Retail Co.',
    status: 'Fulfilled',
    date: 'Oct 18',
    lines: [{ product: 4, qty: 100 }],
  },
  {
    id: 1004,
    customer: 'Atlas Facilities Group',
    status: 'Fulfilled',
    date: 'Oct 18',
    lines: [{ product: 1, qty: 25 }],
  },
  {
    id: 1006,
    customer: 'Cedar Street Market',
    status: 'Cancelled',
    date: 'Oct 19',
    lines: [{ product: 7, qty: 2 }],
  },
];
const state = { filter: 'All', query: '', workFilter: 'Draft', failed: true };
const product = (id) => products.find((p) => p.id === Number(id));
const order = (id) => orders.find((o) => o.id === Number(id));
const available = (p) => p.onHand - p.reserved;
const drafts = () => orders.filter((o) => o.status === 'Draft');
const confirmed = () => orders.filter((o) => o.status === 'Confirmed');
const lowStock = () => products.filter((p) => available(p) <= p.min);
const total = (o) =>
  o.lines.reduce((n, l) => n + product(l.product).price * l.qty, 0);
const number = (o) => `SO-2026-${o.id}`;
const count = (n) => String(n).padStart(2, '0');
const badge = (value) =>
  `<span class="badge ${value.toLowerCase()}">${esc(value)}</span>`;
const button = (label, action, attr = '', style = '') =>
  `<button type="button" class="btn ${style}" data-action="${action}" ${attr}>${label}</button>`;
const brand = () =>
  `<a class="brand" href="#product" aria-label="StockPilot home"><span class="brand-mark" aria-hidden="true"></span>STOCKPILOT <span>/</span></a>`;
const commandTrigger = () =>
  `<button class="search-trigger" data-action="command" aria-label="Search orders, products and actions"><span>${icon('MagnifyingGlass')} FIND ANYTHING</span><kbd class="key">Ctrl K</kbd></button>`;
let transitionAction = null;
let toastTimer;
function route() {
  return location.hash.slice(1).split('?')[0] || 'product';
}
function currentSection() {
  const p = route().split('/');
  return p[1] === 'order'
    ? 'orders'
    : p[1] === 'stock'
      ? 'inventory'
      : p[1] || 'overview';
}
function navigate(path) {
  if (location.hash === `#${path}`) {
    render();
    document.getElementById('main')?.focus({ preventScroll: true });
  } else location.hash = path;
}
function footer() {
  return `<footer class="app-footer"><span>ROUND 02 / LOCAL PROTOTYPE · SIMULATED DATA · RELOAD TO RESET</span><a href="#product">Back to product ${icon('ArrowUpRight')}</a></footer>`;
}
function render() {
  const isApp = route().startsWith('workspace');
  document.title = isApp
    ? 'StockPilot / Control room'
    : 'StockPilot — Stock in focus. Orders in motion.';
  root.innerHTML = `<a href="#main" class="skip">Skip to content</a>${isApp ? workspace() : landing()}<dialog id="form-dialog" aria-labelledby="form-title"></dialog><dialog id="confirm-dialog" aria-labelledby="confirm-title"></dialog><dialog id="info-dialog" aria-labelledby="info-title"></dialog><dialog id="command-dialog" aria-label="Search orders, products and actions"></dialog><div id="live-region" aria-live="polite" aria-atomic="true"></div>`;
  root.querySelectorAll('dialog').forEach((dialog) =>
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        const r = dialog.getBoundingClientRect();
        if (
          event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom
        )
          dialog.close();
      }
    }),
  );
}
function landing() {
  return `<header class="site-header">${brand()}<nav aria-label="Product navigation"><a href="#product-preview">The workspace</a><a href="#workflow">How it works</a><a href="#workspace/overview">Explore demo</a></nav><div class="header-actions">${commandTrigger()}<a class="btn small" href="#workspace/overview">OPEN WORKSPACE ${icon('ArrowUpRight')}</a></div></header><main id="main" tabindex="-1"><section class="hero" aria-labelledby="hero-title"><div class="hero-grid" aria-hidden="true"></div><div class="stock-field" aria-hidden="true"><div class="stock-tiles">${Array.from({ length: 36 }, (_, i) => `<div class="stock-tile ${[1, 7, 9, 17, 18, 26, 28, 34].includes(i) ? 'hot' : ''}"><span>HP-${1001 + (i % 8)}</span><strong>${['180', '012', '008', '064', '035', '048', '090', '056'][i % 8]}</strong><span>${i % 3 === 0 ? 'RESERVED' : i % 3 === 1 ? 'ON HAND' : 'AVAILABLE'}</span></div>`).join('')}</div></div><div class="hero-content"><p class="hero-eyebrow mono">Inventory & B2B operations / Reimagined</p><h1 id="hero-title">Stock in focus.<em>Orders in motion.</em></h1><p class="hero-copy">From the first receipt to the final handoff,<br>know what’s available and what happens next.</p><div class="hero-actions"><a class="btn primary" href="#workspace/overview">ENTER THE WORKSPACE ${icon('ArrowRight')}</a><a class="btn" href="#workflow">SEE THE FLOW ${icon('CaretRight')}</a></div><div class="hero-foot"><span>One warehouse</span><span>Every handoff</span><span>Full context</span></div></div><div class="coordinate" aria-hidden="true"><span>00</span><span>05</span><span>10</span><span>15</span><span>20</span></div><div class="stage-tag"><b>+</b> STOCKPILOT / OPERATIONS IN FULL VIEW</div></section><nav class="workflow-strip" aria-label="Explore workflows">${[
    ['01', 'Receive stock', 'workspace/inventory'],
    ['02', 'Reserve with confidence', 'workspace/order/1002'],
    ['03', 'Fulfill the order', 'workspace/order/1003'],
    ['04', 'Trace every unit', 'workspace/stock/1'],
  ]
    .map(
      ([n, t, url]) =>
        `<a href="#${url}"><span>${n} /</span>${t}${icon('ArrowUpRight')}</a>`,
    )
    .join(
      '',
    )}</nav><section class="site-section" id="product-preview"><div class="section-top"><div class="rule-label"><span>01 / The workspace</span><span>Built around the work</span></div><div class="section-title"><h2>Your operation.<br>One connected view.</h2><p>Review the next order. See what’s holding stock. Resolve the exception without losing the bigger picture.</p></div></div><div class="live-preview"><div class="preview-caption mono"><span><span class="window-dots" aria-hidden="true"><i></i><i></i><i></i></span>STOCKPILOT / HARBOR & PINE</span><span>Actual prototype screen · simulated data</span></div><img src="workspace-preview.png" width="1440" height="1050" alt="The new StockPilot control room: daily pulse on the left, order working set in the center, and stock signals on the right." loading="lazy"><a class="btn primary preview-cta" href="#workspace/overview">EXPLORE THE LIVE PROTOTYPE ${icon('ArrowUpRight')}</a></div></section><section class="site-section" id="workflow"><div class="section-top"><div class="rule-label"><span>02 / The flow</span><span>Clear at every step</span></div><div class="section-title"><h2>Less chasing.<br>More moving.</h2><p>Inventory and orders are one story. Your workspace should read that way.</p></div></div><div class="feature-grid"><article class="feature-cell"><p class="feature-no mono">A / Receive</p><h3>Start with what<br>actually arrived.</h3><p>Record a receipt against a supplier. See on-hand stock update, with reservations kept separate.</p><a href="#workspace/inventory" class="text-link">Explore inventory ${icon('ArrowUpRight')}</a></article><article class="feature-cell"><p class="feature-no mono">B / Reserve</p><h3>Promise stock<br>with the full picture.</h3><p>Review the order and its availability together. Confirm to hold the quantities for this customer.</p><a href="#workspace/order/1002" class="text-link">Review an order ${icon('ArrowUpRight')}</a></article><article class="feature-cell"><p class="feature-no mono">C / Fulfill</p><h3>Close the loop.<br>Keep the history.</h3><p>Complete the handoff. On-hand and reserved quantities change together, so availability stays explainable.</p><a href="#workspace/order/1003" class="text-link">See the handoff ${icon('ArrowUpRight')}</a></article></div></section><section class="site-section"><div class="closing"><h2>Make the next move<br><em>with confidence.</em></h2><a class="btn primary" href="#workspace/overview">OPEN THE WORKSPACE ${icon('ArrowRight')}</a></div></section></main><footer class="site-footer"><a href="https://keyly-docs.com/" target="_blank" rel="noopener noreferrer">VISUAL DIRECTION INSPIRED BY KEYLY ↗</a><span>STOCKPILOT / V2 EXPLORATION 02 · LOCAL SIMULATION · NO SERVER WRITES</span></footer>`;
}
function workspace() {
  const section = currentSection();
  const tabs = [
    ['overview', 'Overview', 'SquaresFour'],
    ['orders', 'Orders', 'ClipboardText'],
    ['inventory', 'Inventory', 'Cube'],
  ];
  const content = route().startsWith('workspace/order/')
    ? orderPage(order(route().split('/')[2]))
    : route().startsWith('workspace/stock/')
      ? stockPage(product(route().split('/')[2]))
      : section === 'orders'
        ? ordersPage()
        : section === 'inventory'
          ? inventoryPage()
          : overview();
  return `<header class="app-header"><div class="app-header-left">${brand()}<div class="org-label"><span class="org-avatar">HP</span>Harbor & Pine Wholesale ${icon('CaretRight')}</div></div><div class="app-header-right">${commandTrigger()}<span class="preview-label">PROTOTYPE</span><span class="profile" aria-label="Morgan Manager, Manager">MM</span></div></header><div class="app-tabs"><nav class="main-tabs" aria-label="Workspace navigation">${tabs.map(([key, label, glyph], i) => `<a href="#workspace/${key}" ${section === key ? 'aria-current="page"' : ''}>${icon(glyph)}${label}<span class="tab-index">0${i + 1}</span></a>`).join('')}<details class="more-nav"><summary>Manage ${icon('CaretRight')}</summary><div class="more-menu">${['Products', 'Partners', 'Receipts', 'Imports', 'Integrations', 'Audit', 'Settings & billing'].map((label) => `<button data-info="${label}">${icon(label === 'Integrations' ? 'PlugsConnected' : label === 'Settings & billing' ? 'GearSix' : 'Package')}${label}</button>`).join('')}</div></details></nav><div class="app-tabs-right"><span class="connection">Local data</span><span>Main warehouse / USD</span></div></div><main id="main" class="app-main" tabindex="-1">${content}${footer()}</main><nav class="mobile-bottom" aria-label="Mobile navigation">${tabs.map(([key, label, glyph]) => `<a href="#workspace/${key}" ${section === key ? 'aria-current="page"' : ''}>${icon(glyph)}${label}</a>`).join('')}<button data-action="command">${icon('MagnifyingGlass')}Find / Go</button></nav>`;
}
function heading(
  meta,
  title,
  copy,
  action = '',
  right = '22 OCT 2026 / MANAGER VIEW',
) {
  return `<div class="page-meta"><span>${meta}</span><span>${right}</span></div><div class="page-heading"><div><h1>${title}</h1><p>${copy}</p></div><div class="heading-actions">${action}</div></div>`;
}
function newOrderButton() {
  return button(`${icon('Plus')} NEW ORDER`, 'new-order', '', 'primary');
}
function overview() {
  const open = [...drafts(), ...confirmed()];
  const value = open.reduce((n, o) => n + total(o), 0);
  return (
    heading(
      'Workspace / Control room',
      'Your next move. <em>In focus.</em>',
      `${drafts().length} drafts to review. ${confirmed().length} order${confirmed().length === 1 ? '' : 's'} ready to leave. The rest, in context.`,
      newOrderButton(),
    ) +
    `<div class="control-grid"><aside class="pulse-column"><div class="column-label"><span>00 / Pulse</span>${icon('SquaresFour')}</div><h2 class="pulse-title">Keep the<br><em>work moving.</em></h2><div class="pulse-metric"><a href="#workspace/orders?status=Draft"><strong class="num">${count(drafts().length)}</strong><span>Orders<br>to review</span></a></div><div class="pulse-metric"><a href="#workspace/orders?status=Confirmed"><strong class="num">${count(confirmed().length)}</strong><span>Ready<br>to fulfill</span></a></div><div class="pulse-metric"><a href="#workspace/inventory?status=Low"><strong class="num">${count(lowStock().length)}</strong><span>SKUs<br>to replenish</span></a></div><p class="pulse-foot">Active order value<strong>${money(value)}</strong>Excludes closed orders.</p></aside><section class="working-column"><div class="column-label"><span>01 / Working set</span><span>${count(open.length)} OPEN</span></div><div class="working-title"><div><h2>Start with the next order.</h2><p>Identity, availability and the next decision.</p></div><kbd class="key">N</kbd></div><div class="work-tabs" aria-label="Working set filter"><button data-work="Draft" aria-pressed="${state.workFilter === 'Draft'}">To review <span class="count">${count(drafts().length)}</span></button><button data-work="Confirmed" aria-pressed="${state.workFilter === 'Confirmed'}">To fulfill <span class="count">${count(confirmed().length)}</span></button><button data-work="All" aria-pressed="${state.workFilter === 'All'}">All open <span class="count">${count(open.length)}</span></button></div><div id="working-results">${workingRecords()}</div><div class="working-foot"><span>Stock is reserved on confirmation.</span><a class="text-link" href="#workspace/orders">Order register ${icon('ArrowUpRight')}</a></div></section><aside class="stock-column"><div class="column-label"><span>02 / Stock signal</span>${badge('Low')}</div><h2>Watch the thresholds.</h2><p>${lowStock().length} SKUs at or below their minimum.</p>${
      lowStock()
        .map(
          (p) =>
            `<article class="signal-record"><a href="#workspace/stock/${p.id}">${esc(p.name)}</a><div class="sku">${p.sku}</div><div class="signal-line"><div><strong>${count(available(p))}</strong><small>${p.unit} available</small></div><span class="mono muted" style="font-size:9px">MIN ${p.min}</span></div><button class="text-link" data-action="receive" data-id="${p.id}">RECEIVE STOCK ${icon('ArrowUpRight')}</button></article>`,
        )
        .join('') ||
      '<div class="signal-record muted">All tracked SKUs are above minimum.</div>'
    }<div class="integration-note"><div class="label"><span>STOREFRONT</span>${badge(state.failed ? 'Failed' : 'Healthy')}</div><p>${state.failed ? 'One delivery needs attention.' : 'No failed deliveries.'}</p><button class="text-link" data-action="integration">${state.failed ? 'INSPECT DELIVERY' : 'VIEW DELIVERY'} ${icon('ArrowUpRight')}</button></div></aside></div><section class="ledger-strip" aria-label="Inventory workflow"><div><span class="mono">One connected flow</span><strong>Every quantity has a reason.</strong></div><div><span class="mono"><b class="flow-index">01</b>Receive</span><strong>Increase on-hand stock.</strong><p>Record the physical receipt.</p></div><div><span class="mono"><b class="flow-index">02</b>Reserve</span><strong>Hold stock for an order.</strong><p>Confirm the customer request.</p></div><div><span class="mono"><b class="flow-index">03</b>Fulfill</span><strong>Complete the handoff.</strong><p>Deduct on-hand and reserved.</p></div></section>`
  );
}
function workingRecords() {
  const rows = orders.filter(
    (o) =>
      ['Draft', 'Confirmed'].includes(o.status) &&
      (state.workFilter === 'All' || o.status === state.workFilter),
  );
  const list =
    rows
      .map(
        (o) =>
          `<article class="work-record"><span class="record-symbol">${icon(o.status === 'Draft' ? 'ClipboardText' : 'Package')}</span><div><a class="record-title" href="#workspace/order/${o.id}">${esc(o.customer)}</a><div class="record-meta"><span>${number(o)}</span>${badge(o.status)}</div></div><div class="record-end"><span class="num">${money(total(o))}</span><a href="#workspace/order/${o.id}">${o.status === 'Draft' ? 'Review order' : 'Open handoff'} ${icon('ArrowUpRight')}</a></div></article>`,
      )
      .join('') ||
    '<div class="empty-state"><h2>All clear.</h2><p>No orders in this working set.</p></div>';
  const next = confirmed()[0];
  return (
    list +
    (state.workFilter === 'Draft' && next
      ? `<aside class="next-handoff"><p class="mono">NEXT / FULFILLMENT</p><div><span><strong>${esc(next.customer)}</strong><small>${number(next)} / ${next.lines.reduce((n, l) => n + l.qty, 0)} units reserved</small></span><a class="text-link" href="#workspace/order/${next.id}">Open handoff ${icon('ArrowUpRight')}</a></div></aside>`
      : '')
  );
}
function filters(type) {
  const entries =
    type === 'orders'
      ? ['All', 'Draft', 'Confirmed', 'Fulfilled']
      : ['All', 'Low'];
  return `<div class="register-toolbar"><label class="search-field">${icon('MagnifyingGlass')}<span class="sr-only">${type === 'orders' ? 'Search orders' : 'Search inventory'}</span><input id="register-search" type="search" autocomplete="off" value="${esc(state.query)}" placeholder="${type === 'orders' ? 'Find order or customer…' : 'Find product or SKU…'}"></label><div class="filter-tabs" aria-label="${type === 'orders' ? 'Order status' : 'Stock status'}">${entries.map((s) => `<button data-filter="${s}" aria-pressed="${state.filter === s}">${s === 'All' ? 'All' : s === 'Confirmed' ? 'To fulfill' : s === 'Low' ? 'Stock watch' : s}<span class="count">${type === 'orders' ? (s === 'All' ? orders.length : orders.filter((o) => o.status === s).length) : s === 'All' ? products.length : lowStock().length}</span></button>`).join('')}</div></div>`;
}
function ordersPage() {
  return (
    heading(
      'Workspace / Order register',
      'Every order.<em> Every handoff.</em>',
      'Review, reserve and fulfill. Keep the customer and the stock in view.',
      newOrderButton(),
    ) +
    filters('orders') +
    `<div id="register-results">${orderResults()}</div>`
  );
}
function orderResults() {
  const q = state.query.toLowerCase();
  const rows = orders.filter(
    (o) =>
      (state.filter === 'All' || o.status === state.filter) &&
      `${number(o)} ${o.customer}`.toLowerCase().includes(q),
  );
  if (!rows.length)
    return '<div class="empty-state"><h2>No matching orders.</h2><p>Try another customer, order number or status.</p></div>';
  return `<table class="register"><caption class="sr-only">Sales order register</caption><thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Status</th><th scope="col">Created</th><th scope="col" class="numeric">Value / USD</th><th scope="col"><span class="sr-only">Open order</span></th></tr></thead><tbody>${rows.map((o) => `<tr><td><a class="reference" href="#workspace/order/${o.id}">${number(o)}</a></td><td><a href="#workspace/order/${o.id}">${esc(o.customer)}</a><small>${o.lines.length} line item${o.lines.length === 1 ? '' : 's'}</small></td><td>${badge(o.status)}</td><td class="muted">${o.date}, 2026</td><td class="numeric">${money(total(o))}</td><td class="numeric"><a class="icon-btn" href="#workspace/order/${o.id}" aria-label="Open ${number(o)}">${icon('ArrowUpRight')}</a></td></tr>`).join('')}</tbody></table><div class="mobile-records">${rows.map((o) => `<article class="mobile-record"><div class="mobile-record-top"><span>${number(o)}</span>${badge(o.status)}</div><a class="mobile-record-title" href="#workspace/order/${o.id}">${esc(o.customer)}</a><div class="mobile-record-bottom"><strong class="num">${money(total(o))}</strong><a href="#workspace/order/${o.id}">Open order ${icon('ArrowUpRight')}</a></div></article>`).join('')}</div><div class="table-foot"><span>${rows.length} OF ${orders.length} ORDERS / ALL VALUES IN USD</span><span>ILLUSTRATIVE DATA / NOT A LIVE ACCOUNT</span></div>`;
}
function inventoryPage() {
  return (
    heading(
      'Workspace / Stock register',
      'Know what you can <em>promise.</em>',
      'On hand is physical. Reserved is committed. Available is what you can sell.',
      button(
        `${icon('Plus')} RECEIVE STOCK`,
        'receive',
        'data-id="3"',
        'primary',
      ),
    ) +
    `<p class="stock-note"><strong>On hand − Reserved = Available.</strong> Select a SKU to see which orders are holding its stock.</p>` +
    filters('inventory') +
    `<div id="register-results">${stockResults()}</div>`
  );
}
function stockResults() {
  const q = state.query.toLowerCase();
  const rows = products.filter(
    (p) =>
      (state.filter !== 'Low' || available(p) <= p.min) &&
      `${p.name} ${p.sku}`.toLowerCase().includes(q),
  );
  if (!rows.length)
    return '<div class="empty-state"><h2>No matching stock.</h2><p>Try another product, SKU or stock filter.</p></div>';
  return `<table class="register"><caption class="sr-only">Inventory balances, available equals on hand minus reserved</caption><thead><tr><th scope="col">SKU / product</th><th scope="col" class="numeric">On hand</th><th scope="col" class="numeric">Reserved</th><th scope="col" class="numeric">Available</th><th scope="col">Signal</th><th scope="col"><span class="sr-only">View stock</span></th></tr></thead><tbody>${rows.map((p) => `<tr><td><a href="#workspace/stock/${p.id}">${esc(p.name)}</a><small class="mono" style="font-size:9px">${p.sku} / ${p.unit}</small></td><td class="numeric">${p.onHand}</td><td class="numeric muted">${p.reserved}</td><td class="numeric"><strong>${available(p)}</strong></td><td>${badge(available(p) <= p.min ? 'Low' : 'Healthy')}</td><td class="numeric"><a class="icon-btn" href="#workspace/stock/${p.id}" aria-label="Explain stock for ${esc(p.name)}">${icon('ArrowUpRight')}</a></td></tr>`).join('')}</tbody></table><div class="mobile-records">${rows.map((p) => `<article class="mobile-record"><div class="mobile-record-top"><span>${p.sku}</span>${badge(available(p) <= p.min ? 'Low' : 'Healthy')}</div><a class="mobile-record-title" href="#workspace/stock/${p.id}">${esc(p.name)}</a><div class="mobile-stock-quantities"><span><small>ON HAND</small>${p.onHand}</span><span><small>RESERVED</small>${p.reserved}</span><span><small>AVAILABLE</small><strong>${available(p)}</strong></span></div><div class="mobile-record-bottom"><span class="muted">Unit / ${p.unit}</span><a href="#workspace/stock/${p.id}">Explain balance ${icon('ArrowUpRight')}</a></div></article>`).join('')}</div><div class="table-foot"><span>${rows.length} OF ${products.length} ACTIVE SKUS / MAIN WAREHOUSE</span><span>RESERVATIONS ARE SEPARATE FROM MOVEMENTS</span></div>`;
}
function orderPage(o) {
  if (!o)
    return '<div class="empty-state"><h2>Order not found.</h2><a class="text-link" href="#workspace/orders">Back to orders</a></div>';
  const canConfirm = o.lines.every(
    (l) => available(product(l.product)) >= l.qty,
  );
  const closed = ['Fulfilled', 'Cancelled'].includes(o.status);
  return (
    `<a href="#workspace/orders" class="back-link">${icon('ArrowRight')} Back to order register</a>` +
    heading(
      `Sales order / ${number(o)}`,
      esc(o.customer),
      `${number(o)} / Main warehouse / USD`,
      badge(o.status),
      'ORDER DETAIL / MANAGER VIEW',
    ) +
    `<div class="object-grid"><aside class="object-summary"><div class="column-label"><span>00 / Context</span></div><dl class="fact"><dt>Customer</dt><dd>${esc(o.customer)}<small>Wholesale account</small></dd></dl><dl class="fact"><dt>Created</dt><dd>${o.date}, 2026</dd></dl><dl class="fact"><dt>Warehouse</dt><dd>Main warehouse</dd></dl><dl class="fact"><dt>Order state</dt><dd>${badge(o.status)}</dd></dl></aside><section class="object-center"><div class="column-label"><span>01 / Line items</span><span>${count(o.lines.length)} LINES</span></div><h2>The request, in detail.</h2><table class="register"><caption class="sr-only">Order line items</caption><thead><tr><th scope="col">Product</th><th scope="col" class="numeric">Qty</th><th scope="col" class="numeric mobile-hide">Unit price</th><th scope="col" class="numeric">Amount</th></tr></thead><tbody>${o.lines.map((l) => `<tr><td><a href="#workspace/stock/${l.product}">${esc(product(l.product).name)}</a><small>${product(l.product).sku}</small></td><td class="numeric">${l.qty}</td><td class="numeric mobile-hide">${money(product(l.product).price)}</td><td class="numeric">${money(l.qty * product(l.product).price)}</td></tr>`).join('')}</tbody></table><div class="order-total"><span>Order total</span><strong>${money(total(o))}</strong></div><section class="activity"><h3>Activity</h3><p><span class="mono">${o.date}</span> / Created as a draft</p>${o.status !== 'Draft' ? `<p><span class="mono">CURRENT</span> / ${o.status}${o.simulated ? ' in this preview' : ''}</p>` : ''}</section></section><aside class="object-context"><div class="column-label"><span>02 / Stock context</span></div><div class="context-message ${!canConfirm && o.status === 'Draft' ? 'warning' : ''}">${icon(closed ? 'Info' : canConfirm || o.status === 'Confirmed' ? 'CheckCircle' : 'Warning')}<h3>${closed ? 'The handoff is closed.' : o.status === 'Confirmed' ? 'Reserved. Ready to move.' : canConfirm ? 'Available. Ready to reserve.' : 'More stock is needed.'}</h3><p>${closed ? 'This order no longer holds stock. Its final state remains part of the order history.' : o.status === 'Confirmed' ? 'These quantities are held for this customer. Mark fulfilled after the full order leaves the warehouse.' : canConfirm ? 'All requested quantities are available. Confirming the order reserves them for this customer.' : 'Receive the missing stock before confirming this order.'}</p></div><div>${o.lines.map((l) => `<div class="stock-check"><span>${product(l.product).sku}</span><span>${o.status === 'Confirmed' ? `${l.qty} HELD` : closed ? 'CLOSED' : `${available(product(l.product))} AVAIL / ${l.qty} NEEDED`}</span></div>`).join('')}</div></aside></div><footer class="object-actionbar"><p><strong>${closed ? 'This order is complete.' : o.status === 'Confirmed' ? 'Ready for the final handoff?' : 'Ready to commit this stock?'}</strong>${closed ? 'Browse the order register for your next task.' : o.status === 'Confirmed' ? 'All quantities will leave on-hand stock and their reservations will be released.' : 'The quantities will be reserved. Physical stock stays on hand until fulfillment.'}</p>${closed ? `<a class="btn" href="#workspace/orders">BACK TO ORDERS ${icon('ArrowRight')}</a>` : button(o.status === 'Draft' ? 'CONFIRM & RESERVE' : 'MARK FULFILLED', 'transition', `data-id="${o.id}" ${o.status === 'Draft' && !canConfirm ? 'disabled' : ''}`, 'pink')}</footer>`
  );
}
function stockPage(p) {
  if (!p)
    return '<div class="empty-state"><h2>Product not found.</h2><a class="text-link" href="#workspace/inventory">Back to inventory</a></div>';
  const reservations = confirmed().flatMap((o) =>
    o.lines.filter((l) => l.product === p.id).map((l) => ({ o, qty: l.qty })),
  );
  return (
    `<a class="back-link" href="#workspace/inventory">${icon('ArrowRight')} Back to stock register</a>` +
    heading(
      `Stock explanation / ${p.sku}`,
      esc(p.name),
      `Main warehouse / Unit: ${p.unit}`,
      button(
        `${icon('Plus')} RECEIVE STOCK`,
        'receive',
        `data-id="${p.id}"`,
        'primary',
      ),
      'SKU DETAIL / MANAGER VIEW',
    ) +
    `<div class="object-grid"><aside class="object-summary"><div class="column-label"><span>00 / Identity</span></div><dl class="fact"><dt>SKU</dt><dd class="mono">${p.sku}</dd></dl><dl class="fact"><dt>Stock signal</dt><dd>${badge(available(p) <= p.min ? 'Low' : 'Healthy')}</dd></dl><dl class="fact"><dt>Minimum</dt><dd>${p.min} ${p.unit}</dd></dl><dl class="fact"><dt>Unit price</dt><dd>${money(p.price)}</dd></dl></aside><section class="object-center"><div class="column-label"><span>01 / Balance</span><span>IN ${p.unit.toUpperCase()}</span></div><h2>Every unit, accounted for.</h2><div class="stock-equation" aria-label="${p.onHand} on hand minus ${p.reserved} reserved equals ${available(p)} available"><div><strong>${count(p.onHand)}</strong><small>On hand</small></div><span>−</span><div><strong>${count(p.reserved)}</strong><small>Reserved</small></div><span>=</span><div><strong class="accent">${count(available(p))}</strong><small>Available</small></div></div><h3 style="font-size:14px;margin:25px 0 10px">Orders holding stock</h3>${reservations.map((r) => `<div class="reservation"><div><a href="#workspace/order/${r.o.id}">${number(r.o)}</a><small>${esc(r.o.customer)}</small></div><strong>${r.qty} ${p.unit}</strong></div>`).join('') || '<p class="muted" style="font-size:12px;padding:17px 0">No confirmed orders currently reserve this SKU.</p>'}</section><aside class="object-context"><div class="column-label"><span>02 / Read the balance</span></div><div class="context-message ${available(p) <= p.min ? 'warning' : ''}">${icon(available(p) <= p.min ? 'Warning' : 'CheckCircle')}<h3>${available(p) <= p.min ? 'Time to replenish.' : 'Ready for the next order.'}</h3><p>${available(p) <= p.min ? `Available stock is at or below the minimum of ${p.min}. Receive actual deliveries to replenish it.` : 'Available stock is above the configured minimum.'}</p></div><div class="activity"><h3>Why these numbers differ</h3><p>On hand is physically in the warehouse.</p><p>Reserved is held by confirmed orders.</p><p>Available is what you can promise next.</p></div></aside></div>`
  );
}
function openForm(title, body, kind) {
  const dialog = document.getElementById('form-dialog');
  dialog.innerHTML = `<form id="command-form" data-kind="${kind}"><header class="dialog-header"><h2 id="form-title">${title}</h2><button type="button" class="icon-btn" data-close="form-dialog" aria-label="Close form">${icon('X')}</button></header><div class="dialog-body">${body}</div><footer class="dialog-actions"><small>SIMULATION / NO SERVER WRITES</small><button type="button" class="btn" data-close="form-dialog">CANCEL</button><button type="submit" class="btn pink">${kind === 'order' ? 'CREATE DRAFT' : 'APPLY RECEIPT'}</button></footer></form>`;
  dialog.showModal();
}
function openNewOrder() {
  openForm(
    'Create a sales order.',
    `<p>A draft first. Reserve stock only when you confirm.</p><div class="form-grid"><label class="field full">Customer<select name="customer">${['Cedar Street Market', 'Northstar Office Supply', 'Bluebird Hospitality', 'Goodship Retail Co.', 'Atlas Facilities Group'].map((n) => `<option>${n}</option>`).join('')}</select></label><label class="field full">Product<select id="form-product" name="product">${products.map((p) => `<option value="${p.id}">${p.name} / ${p.sku}</option>`).join('')}</select></label><label class="field">Quantity<input id="form-quantity" name="quantity" type="number" value="1" min="1" max="10000" step="1" required></label><div class="field"><span>Unit price</span><strong id="form-unit-price" class="form-price">${money(products[0].price)}</strong></div></div><div class="order-total" style="margin-top:24px"><span>Draft total</span><strong id="form-total">${money(products[0].price)}</strong></div><p class="form-note">This exploration demonstrates one line per new draft. The existing app’s multi-line editor remains part of v2 scope.</p>`,
    'order',
  );
}
function openReceive(id) {
  const p = product(id);
  openForm(
    'Record a physical receipt.',
    `<p>${esc(p.name)} / ${p.sku}<br>${available(p)} ${p.unit} currently available.</p><input type="hidden" name="product" value="${p.id}"><div class="form-grid"><label class="field full">Supplier<select name="supplier"><option>Harbor Packaging Supply</option><option>Pacific Trade Co.</option><option>Northline Materials</option></select></label><label class="field">Quantity received<input type="number" name="quantity" value="10" min="1" max="10000" step="1" required></label><label class="field">Supplier reference<input name="reference" placeholder="e.g. DN-2026-042" maxlength="80" required></label></div><p class="form-note">Only record what physically arrived. This increases on-hand stock and preserves current reservations.</p>`,
    'receipt',
  );
}
function openTransition(o) {
  const isDraft = o.status === 'Draft';
  const dialog = document.getElementById('confirm-dialog');
  dialog.innerHTML = `<header class="dialog-header"><h2 id="confirm-title">${isDraft ? 'Reserve this order’s stock?' : 'Complete the handoff?'}</h2><button class="icon-btn" aria-label="Close confirmation" data-close="confirm-dialog">${icon('X')}</button></header><div class="dialog-body"><p><strong>${number(o)} / ${esc(o.customer)}</strong></p><p>${isDraft ? 'Requested quantities will be reserved. On-hand stock stays unchanged.' : 'All order quantities will be deducted from both on-hand and reserved stock.'}</p><div class="order-total"><span>Order value</span><strong>${money(total(o))}</strong></div></div><footer class="dialog-actions"><small>LOCAL SIMULATION</small>${button('GO BACK', 'close-confirm')}${button(isDraft ? 'CONFIRM & RESERVE' : 'MARK FULFILLED', 'apply-transition', '', 'pink')}</footer>`;
  transitionAction = () => {
    if (!['Draft', 'Confirmed'].includes(o.status)) return;
    if (
      isDraft &&
      !o.lines.every((l) => available(product(l.product)) >= l.qty)
    ) {
      toast('Insufficient available stock. Receive stock before confirming.');
      return;
    }
    for (const l of o.lines) {
      const p = product(l.product);
      if (isDraft) p.reserved += l.qty;
      else {
        p.reserved -= l.qty;
        p.onHand -= l.qty;
      }
    }
    o.status = isDraft ? 'Confirmed' : 'Fulfilled';
    o.simulated = true;
    dialog.close();
    render();
    document.getElementById('main').focus({ preventScroll: true });
    toast(
      `${number(o)} ${isDraft ? 'confirmed; stock reserved' : 'fulfilled; stock deducted'} in this preview.`,
    );
  };
  dialog.showModal();
}
function info(title, body) {
  const dialog = document.getElementById('info-dialog');
  dialog.innerHTML = `<header class="dialog-header"><h2 id="info-title">${title}</h2><button class="icon-btn" data-close="info-dialog" aria-label="Close details">${icon('X')}</button></header><div class="dialog-body">${body}</div>`;
  dialog.showModal();
}
function openIntegration() {
  info(
    'Storefront / Delivery.',
    `<div class="page-meta"><span>storefront-demo-failure-001</span>${badge(state.failed ? 'Failed' : 'Fulfilled')}</div><p>${state.failed ? 'Processing was interrupted. No draft was created. A retry should safely process the original delivery.' : 'The simulated retry created one draft. This preview prevents a second retry.'}</p><div class="stock-note">Northstar Office Supply<br>Padded Mailer Medium × 4 / ${money(10)}</div>${state.failed ? button('RETRY DELIVERY', 'retry', '', 'pink') : `<a class="btn" href="#workspace/orders">OPEN ORDERS ${icon('ArrowUpRight')}</a>`}<p class="form-note">Illustrative event, local simulation. Final implementation retains the app’s existing idempotent retry handling.</p>`,
  );
}
function commandRows(query = '') {
  const q = query.toLowerCase();
  const actions = [
    ['Overview', 'Your control room', 'workspace/overview', 'SquaresFour'],
    ['Order register', 'All sales orders', 'workspace/orders', 'ClipboardText'],
    [
      'Inventory',
      'Stock balances and reservations',
      'workspace/inventory',
      'Cube',
    ],
  ];
  let html = `<div class="command-group">Go to / Actions</div>${actions
    .filter((a) => `${a[0]} ${a[1]}`.toLowerCase().includes(q))
    .map(
      ([t, sub, url, glyph]) =>
        `<a class="command-result" href="#${url}">${icon(glyph)}<span>${t}<small>${sub}</small></span>${icon('ArrowUpRight')}</a>`,
    )
    .join(
      '',
    )}${'new order create draft'.includes(q) ? `<button class="command-result" data-action="new-order">${icon('Plus')}<span>Create a draft<small>No stock reserved until confirmation</small></span><kbd class="key">N</kbd></button>` : ''}`;
  const os = orders.filter((o) =>
    `${number(o)} ${o.customer}`.toLowerCase().includes(q),
  );
  const ps = products.filter((p) =>
    `${p.sku} ${p.name}`.toLowerCase().includes(q),
  );
  if (os.length)
    html += `<div class="command-group">Orders</div>${os
      .slice(0, 4)
      .map(
        (o) =>
          `<a class="command-result" href="#workspace/order/${o.id}">${icon('ClipboardText')}<span>${esc(o.customer)}<small>${number(o)} / ${o.status}</small></span><span>${money(total(o))}</span></a>`,
      )
      .join('')}`;
  if (ps.length)
    html += `<div class="command-group">Inventory</div>${ps
      .slice(0, 4)
      .map(
        (p) =>
          `<a class="command-result" href="#workspace/stock/${p.id}">${icon('Cube')}<span>${esc(p.name)}<small>${p.sku} / ${available(p)} ${p.unit} available</small></span>${icon('ArrowUpRight')}</a>`,
      )
      .join('')}`;
  if (
    q &&
    !os.length &&
    !ps.length &&
    !actions.some((a) => `${a[0]} ${a[1]}`.toLowerCase().includes(q)) &&
    !'new order create draft'.includes(q)
  )
    html =
      '<div class="empty-state"><h2>No results.</h2><p>Try an order number, customer or SKU.</p></div>';
  return html;
}
function openCommand() {
  const dialog = document.getElementById('command-dialog');
  if (dialog.open) {
    dialog.close();
    return;
  }
  dialog.innerHTML = `<div class="command-search">${icon('MagnifyingGlass')}<label for="command-search" class="sr-only">Find order, customer, SKU or action</label><input type="search" id="command-search" placeholder="Find order, customer, SKU or action…" autocomplete="off" autofocus><button class="icon-btn" data-close="command-dialog" aria-label="Close search">${icon('X')}</button></div><div class="command-list" id="command-results">${commandRows()}</div><div class="command-foot"><span>↓ / ↑ TO FOCUS RESULTS · ENTER TO OPEN</span><span>ESC TO CLOSE</span></div>`;
  dialog.showModal();
}
function toast(message) {
  clearTimeout(toastTimer);
  document.getElementById('live-region').innerHTML =
    `<div class="toast">${esc(message)}</div>`;
  toastTimer = setTimeout(() => {
    const el = document.getElementById('live-region');
    if (el) el.innerHTML = '';
  }, 5000);
}
root.addEventListener('click', (event) => {
  const anchor = event.target.closest('a');
  if (anchor?.classList.contains('skip')) {
    event.preventDefault();
    document.getElementById('main').focus();
    return;
  }
  if (anchor?.closest('dialog')) anchor.closest('dialog').close();
  const close = event.target.closest('[data-close]');
  if (close) {
    document.getElementById(close.dataset.close).close();
    return;
  }
  const infoButton = event.target.closest('[data-info]');
  if (infoButton) {
    const title = infoButton.dataset.info;
    if (title === 'Integrations') {
      openIntegration();
      return;
    }
    info(
      esc(title),
      `<p>This module is included in the full v2 redesign.</p><p>This round focuses on the public experience, control room, order register, inventory and full object pages so the new layout can be reviewed in depth.</p><p class="form-note">Supporting module / Prototype scope only. Existing production capabilities remain in the app.</p>`,
    );
    return;
  }
  const filter = event.target.closest('[data-filter]');
  if (filter) {
    state.filter = filter.dataset.filter;
    document
      .querySelectorAll('[data-filter]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b === filter)));
    document.getElementById('register-results').innerHTML =
      currentSection() === 'orders' ? orderResults() : stockResults();
    return;
  }
  const work = event.target.closest('[data-work]');
  if (work) {
    state.workFilter = work.dataset.work;
    document
      .querySelectorAll('[data-work]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b === work)));
    document.getElementById('working-results').innerHTML = workingRecords();
    return;
  }
  const action = event.target.closest('[data-action]');
  if (!action) return;
  switch (action.dataset.action) {
    case 'command':
      openCommand();
      break;
    case 'new-order':
      if (document.getElementById('command-dialog').open)
        document.getElementById('command-dialog').close();
      openNewOrder();
      break;
    case 'receive':
      openReceive(action.dataset.id || 3);
      break;
    case 'transition':
      openTransition(order(action.dataset.id));
      break;
    case 'apply-transition':
      if (transitionAction) transitionAction();
      break;
    case 'close-confirm':
      document.getElementById('confirm-dialog').close();
      break;
    case 'integration':
      openIntegration();
      break;
    case 'retry':
      if (!state.failed) return;
      state.failed = false;
      orders.unshift({
        id: Math.max(...orders.map((o) => o.id)) + 1,
        customer: 'Northstar Office Supply',
        status: 'Draft',
        date: 'Oct 22',
        lines: [{ product: 1, qty: 4 }],
      });
      document.getElementById('info-dialog').close();
      render();
      toast(
        'Retry simulated. Exactly one new draft was added to this preview.',
      );
      break;
  }
});
root.addEventListener('input', (event) => {
  if (event.target.id === 'register-search') {
    state.query = event.target.value;
    document.getElementById('register-results').innerHTML =
      currentSection() === 'orders' ? orderResults() : stockResults();
  }
  if (event.target.id === 'command-search')
    document.getElementById('command-results').innerHTML = commandRows(
      event.target.value,
    );
  if (['form-product', 'form-quantity'].includes(event.target.id)) {
    const p = product(document.getElementById('form-product').value);
    document.getElementById('form-unit-price').textContent = money(p.price);
    document.getElementById('form-total').textContent = money(
      p.price * Number(document.getElementById('form-quantity').value),
    );
  }
});
root.addEventListener('submit', (event) => {
  if (event.target.id !== 'command-form') return;
  event.preventDefault();
  const form = event.target;
  const values = new FormData(form);
  const qty = Number(values.get('quantity'));
  const p = product(values.get('product'));
  if (!Number.isInteger(qty) || qty < 1 || qty > 10000 || !p) return;
  if (form.dataset.kind === 'order') {
    const o = {
      id: Math.max(...orders.map((o) => o.id)) + 1,
      customer: String(values.get('customer')),
      status: 'Draft',
      date: 'Oct 22',
      lines: [{ product: p.id, qty }],
    };
    orders.unshift(o);
    document.getElementById('form-dialog').close();
    navigate(`workspace/order/${o.id}`);
    setTimeout(
      () => toast(`${number(o)} created as a draft. Stock remains unreserved.`),
      0,
    );
  } else {
    p.onHand += qty;
    document.getElementById('form-dialog').close();
    render();
    document.getElementById('main').focus({ preventScroll: true });
    toast(
      `Receipt simulated: +${qty} ${p.unit} of ${p.name}. Reservations unchanged.`,
    );
  }
});
document.addEventListener('keydown', (event) => {
  const typing =
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) ||
    event.target.isContentEditable;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    openCommand();
    return;
  }
  if (
    event.target.id === 'command-search' &&
    ['ArrowDown', 'ArrowUp'].includes(event.key)
  ) {
    const results = [
      ...document.querySelectorAll(
        '#command-results a,#command-results button',
      ),
    ];
    if (results.length) {
      event.preventDefault();
      (event.key === 'ArrowDown'
        ? results[0]
        : results[results.length - 1]
      ).focus();
    }
    return;
  }
  if (
    event.target.closest('#command-results') &&
    ['ArrowDown', 'ArrowUp'].includes(event.key)
  ) {
    const results = [
      ...document.querySelectorAll(
        '#command-results a,#command-results button',
      ),
    ];
    const index = results.indexOf(event.target.closest('a,button'));
    if (index >= 0) {
      event.preventDefault();
      results[
        (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) %
          results.length
      ].focus();
    }
    return;
  }
  if (
    event.key.toLowerCase() === 'n' &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !typing &&
    !document.querySelector('dialog[open]') &&
    route().startsWith('workspace')
  ) {
    event.preventDefault();
    openNewOrder();
  }
});
function applyRoute() {
  const status = new URLSearchParams(location.hash.split('?')[1] || '').get(
    'status',
  );
  state.filter = (currentSection() === 'orders'
    ? ['All', 'Draft', 'Confirmed', 'Fulfilled']
    : ['All', 'Low']
  ).includes(status)
    ? status
    : 'All';
  state.query = '';
  render();
}
window.addEventListener('hashchange', () => {
  const section = document.getElementById(route());
  if (section && ['workflow', 'product-preview'].includes(route())) {
    section.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
    return;
  }
  applyRoute();
  document.getElementById('main')?.focus({ preventScroll: true });
  const destination = document.getElementById(route());
  if (destination && ['workflow', 'product-preview'].includes(route()))
    destination.scrollIntoView({ block: 'start', behavior: 'instant' });
  else window.scrollTo({ top: 0, behavior: 'instant' });
});
applyRoute();
