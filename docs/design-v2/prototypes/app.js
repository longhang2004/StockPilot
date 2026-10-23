/* Review-only prototype. All changes live in this iframe's memory. No API calls. */
/* global document, URLSearchParams, location, window, URL, history, clearTimeout, setTimeout, matchMedia, FormData */
'use strict';
const root = document.getElementById('root');
const params = new URLSearchParams(location.search);
const concepts = {
  atlas: {
    letter: 'A',
    name: 'Atlas',
    short: 'Rõ ràng để điều hành',
    description:
      'Sidebar cố định, tổng quan chọn lọc, chi tiết mở bên cạnh. Ưu tiên quyết định của quản lý.',
    fit: 'Cân bằng giữa dấu ấn thương hiệu và vận hành mỗi ngày.',
    tradeoff:
      'Chi tiết đơn mở theo ngữ cảnh; chưa tối ưu bằng B khi xử lý hàng loạt.',
    test: 'Từ Overview, mở một draft → duyệt đơn → kiểm tra số Reserved trong Inventory.',
  },
  relay: {
    letter: 'B',
    name: 'Relay',
    short: 'Tập trung để xử lý',
    description:
      'Hàng đợi và chi tiết cùng màn hình, điều hướng thu gọn, nền tối. Ưu tiên xử lý liên tục.',
    fit: 'Đội vận hành thường xuyên duyệt và xuất nhiều đơn liên tiếp.',
    tradeoff: 'Mật độ cao hơn; trên mobile chuyển thành danh sách → chi tiết.',
    test: 'Vào Orders, chọn nhiều đơn liên tiếp ở cột trái rồi thử Confirm / Fulfill.',
  },
  folio: {
    letter: 'C',
    name: 'Folio',
    short: 'Nhìn rõ bước tiếp theo',
    description:
      'Điều hướng ngang, typography có cá tính, công việc chia theo bước. Ưu tiên dễ hiểu và khả năng trình bày.',
    fit: 'Portfolio có nhận diện riêng; chủ doanh nghiệp nhìn thấy luồng công việc.',
    tradeoff:
      'Bảng tác vụ chiếm diện tích hơn danh sách; cần kiểm chứng khi dữ liệu lớn.',
    test: 'Từ ba cột công việc, mở đơn chờ xuất hoặc nhận thêm hàng cho SKU sắp hết.',
  },
};
const e = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (s) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        s
      ],
  );
const icon = (name) => window.prototypeIcons?.[name] ?? '';
const money = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    value,
  );
const btn = (label, action, extra = '', type = '') =>
  `<button type="button" class="btn ${type}" data-action="${action}" ${extra}>${label}</button>`;
const badge = (value) =>
  `<span class="badge ${e(value.toLowerCase())}">${e(value)}</span>`;
const linkButton = (label, action, extra = '') =>
  `<button type="button" class="text-link" data-action="${action}" ${extra}>${label} ${icon('ArrowUpRight')}</button>`;

if (!params.has('preview')) renderGallery();
else if (params.get('surface') === 'landing')
  window.renderStockPilotLanding(root, params, icon);
else renderProduct();

function renderGallery() {
  let current = Object.hasOwn(concepts, params.get('concept'))
    ? params.get('concept')
    : 'atlas';
  let surface = params.get('surface') === 'app' ? 'app' : 'landing';
  root.innerHTML = `<main class="gallery"><header class="gallery-header"><div><h1 class="gallery-title">StockPilot <span>/ Design refinement</span></h1><p>Trở lại ba style trước. Landing và ứng dụng được tinh gọn theo cùng một hệ thiết kế.</p></div><span class="draft-label">Vòng 03 · Prototype</span></header><nav class="directions" aria-label="Hướng thiết kế">${Object.entries(
    concepts,
  )
    .map(
      ([key, c]) =>
        `<button class="direction" data-concept="${key}" aria-pressed="${key === current}"><span class="letter">${c.letter}</span><span><strong>${c.name}</strong><small>${c.short}</small></span></button>`,
    )
    .join(
      '',
    )}</nav><div class="review-toolbar"><div class="surface-switch" aria-label="Phần giao diện"><button data-surface="landing" aria-pressed="${surface === 'landing'}">Landing page</button><button data-surface="app" aria-pressed="${surface === 'app'}">Ứng dụng</button><a id="open-preview" target="_blank" rel="noopener noreferrer">Mở riêng ${icon('ArrowUpRight')}</a></div><div class="device-switch" aria-label="Kích thước xem"><button data-device="desktop" aria-pressed="true">${icon('Desktop')} Co giãn</button><button data-device="mobile" aria-pressed="false">${icon('DeviceMobile')} Mobile</button></div></div><p class="review-description" id="direction-description"></p><div class="preview-wrap" id="preview-wrap"><div class="browser-strip"><i></i><i></i><i></i><span id="preview-location"></span></div><iframe id="preview" title="StockPilot prototype tương tác"></iframe></div><aside class="review-notes"><p id="fit"></p><p id="tradeoff"></p><p id="try"></p></aside><p class="gallery-foot">Dữ liệu minh họa. Thao tác chỉ chạy trong bộ nhớ và được đặt lại khi đổi mẫu / tải lại. Tham khảo bố cục từ Attio, Linear và inFlow; hình trong landing được chụp từ chính prototype StockPilot.</p></main>`;
  function choose(key) {
    current = key;
    const c = concepts[key];
    document
      .querySelectorAll('[data-concept]')
      .forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.concept === key)),
      );
    document.getElementById('direction-description').innerHTML =
      `<strong>${c.letter} / ${c.name}.</strong> ${c.description}`;
    document.getElementById('fit').innerHTML =
      `<strong>Phù hợp:</strong> ${c.fit}`;
    document.getElementById('tradeoff').innerHTML =
      `<strong>Đánh đổi:</strong> ${c.tradeoff}`;
    document.getElementById('try').innerHTML =
      `<strong>Nên thử:</strong> ${c.test}`;
    document.getElementById('preview-location').textContent =
      `StockPilot / ${c.name} / ${surface === 'landing' ? 'Landing' : 'Workspace'}`;
    const previewUrl = `index.html?preview=${key}${surface === 'landing' ? '&surface=landing' : key === 'relay' ? '&screen=orders' : ''}`;
    document.getElementById('preview').src = previewUrl;
    document.getElementById('open-preview').href = previewUrl;
    const url = new URL(location.href);
    url.searchParams.set('concept', key);
    url.searchParams.set('surface', surface);
    history.replaceState(null, '', url);
  }
  root.addEventListener('click', (event) => {
    const direction = event.target.closest('[data-concept]');
    if (direction) choose(direction.dataset.concept);
    const surfaceButton = event.target.closest('[data-surface]');
    if (surfaceButton) {
      surface = surfaceButton.dataset.surface;
      document
        .querySelectorAll('[data-surface]')
        .forEach((button) =>
          button.setAttribute('aria-pressed', String(button === surfaceButton)),
        );
      choose(current);
    }
    const device = event.target.closest('[data-device]');
    if (device) {
      document
        .querySelectorAll('[data-device]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === device)));
      document
        .getElementById('preview-wrap')
        .classList.toggle('mobile', device.dataset.device === 'mobile');
    }
  });
  choose(current);
}

function renderProduct() {
  document.documentElement.lang = 'en';
  document.title = 'StockPilot — Operations workspace';
  document.documentElement.lang = 'en';
  const concept = Object.hasOwn(concepts, params.get('preview'))
    ? params.get('preview')
    : 'atlas';
  const initialPage = ['overview', 'orders', 'inventory', 'receipts'].includes(
    params.get('screen'),
  )
    ? params.get('screen')
    : 'overview';
  const state = {
    page: initialPage,
    filter: 'All',
    query: '',
    selected: 1002,
    failed: true,
    receiptCount: 0,
  };
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
  const receipts = [];
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
  const product = (id) => products.find((p) => p.id === Number(id));
  const order = (id) => orders.find((o) => o.id === Number(id));
  const available = (p) => p.onHand - p.reserved;
  const lowStock = () => products.filter((p) => available(p) <= p.min);
  const drafts = () => orders.filter((o) => o.status === 'Draft');
  const confirmed = () => orders.filter((o) => o.status === 'Confirmed');
  const total = (o) =>
    o.lines.reduce(
      (sum, line) => sum + product(line.product).price * line.qty,
      0,
    );
  const orderNumber = (o) => `SO-2026-${o.id}`;
  const receiptNumber = (r) => `RC-2026-${String(r.id).padStart(4, '0')}`;
  const nav = [
    ['overview', 'Overview', 'SquaresFour'],
    ['orders', 'Orders', 'ClipboardText'],
    ['inventory', 'Inventory', 'Cube'],
    ['receipts', 'Receipts', 'Receipt'],
  ];
  let confirmAction = null;
  let toastTimer;

  function navigationItems(mobile = false) {
    return nav
      .map(
        ([key, label, glyph]) =>
          `<button type="button" ${mobile ? '' : 'class="nav-item"'} data-page="${key}" ${state.page === key ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span>${!mobile && key === 'orders' ? `<span class="nav-count">${drafts().length}</span>` : !mobile && key === 'receipts' && receipts.length ? `<span class="nav-count">${receipts.length}</span>` : ''}</button>`,
      )
      .join('');
  }
  function shell() {
    const brand = `<div class="brand"><span class="brand-symbol">${icon('Stack')}</span><span class="brand-name">StockPilot<span style="color:var(--accent)">.</span></span></div>`;
    root.innerHTML = `<div class="app ${concept} workspace-view"><a class="skip" href="#main">Skip to content</a>${
      concept !== 'folio'
        ? `<aside class="app-sidebar">${brand}<div class="workspace-pick"><span class="workspace-logo">H&P</span><span><strong>Harbor & Pine</strong><small>Wholesale workspace</small></span></div><nav aria-label="Main navigation"><div class="nav-group"><span class="nav-group-label">Operations</span>${navigationItems()}</div><div class="nav-group"><span class="nav-group-label">Workspace</span>${[
            ['Products', 'Package'],
            ['Partners', 'UsersThree'],
          ]
            .map(
              ([label, glyph]) =>
                `<button class="nav-item" data-info="${label}">${icon(glyph)}<span>${label}</span></button>`,
            )
            .join(
              '',
            )}</div></nav><div class="sidebar-bottom"><button class="nav-item" data-info="Settings">${icon('GearSix')}<span>Settings & team</span></button><div class="profile"><span class="avatar">MM</span><span><strong>Morgan Manager</strong><small>Manager · Pro workspace</small></span></div></div></aside>`
        : ''
    }<div class="app-body"><header class="topbar">${concept === 'folio' ? brand : `<div class="breadcrumb"><span>Harbor & Pine</span>${icon('CaretRight')}<strong>${state.page === 'overview' ? 'Workspace overview' : state.page === 'orders' ? 'Sales orders' : state.page === 'receipts' ? 'Stock receipts' : 'Inventory'}</strong></div>`}${concept === 'folio' ? `<nav class="folio-nav" aria-label="Main navigation">${nav.map(([key, label]) => `<button data-page="${key}" ${state.page === key ? 'aria-current="page"' : ''}>${label}</button>`).join('')}<button data-info="Settings">Manage</button></nav>` : ''}<div class="topbar-tools"><span class="demo">PROTOTYPE</span><button class="search-jump" data-action="search" aria-label="Search workspace">${icon('MagnifyingGlass')} Search workspace <kbd>Ctrl K</kbd></button><span class="avatar" aria-label="Morgan Manager, Manager">MM</span></div></header><main id="main" class="app-main" tabindex="-1"></main></div><nav class="mobile-nav" aria-label="Mobile navigation">${navigationItems(true)}<button data-info="More">${icon('DotsThree')}<span>More</span></button></nav><dialog class="side-sheet" id="detail" aria-labelledby="detail-title"></dialog><dialog id="form-dialog" aria-labelledby="form-title"></dialog><dialog id="confirmation" aria-labelledby="confirm-title"></dialog><dialog id="command-dialog" aria-labelledby="command-title"></dialog><div id="toast-region" aria-live="polite" aria-atomic="true"></div></div>`;
    renderMain();
  }
  function pageHeading(title, copy, action, label = '') {
    return `<div class="page-heading"><div>${label ? `<div class="date-label">${label}</div>` : ''}<h1>${title}</h1><p>${copy}</p></div><div class="heading-actions">${action}</div></div>`;
  }
  const newOrderButton = () =>
    btn(`${icon('Plus')} New order`, 'new-order', '', 'primary');
  const receiveButton = (id = 3) =>
    btn(
      `${icon('Plus')} Receive stock`,
      'receive',
      `data-id="${id}"`,
      'primary',
    );
  const notice = () =>
    `<p class="prototype-notice">${icon('Info')} Illustrative data · Manager view · Changes stay in this preview and reset on reload.</p>`;
  function renderMain() {
    const main = document.getElementById('main');
    main.innerHTML =
      (state.page === 'overview'
        ? overview()
        : state.page === 'orders'
          ? ordersPage()
          : state.page === 'inventory'
            ? inventoryPage()
            : receiptsPage()) + notice();
  }
  function metrics() {
    const openValue = [...drafts(), ...confirmed()].reduce(
      (sum, o) => sum + total(o),
      0,
    );
    return `<div class="metric-strip" aria-label="Operational summary"><div class="metric"><span>Open order value</span><strong class="num">${money(openValue)}</strong><small>${drafts().length + confirmed().length} active orders</small></div><div class="metric"><span>To review</span><strong class="num">${String(drafts().length).padStart(2, '0')}</strong><small>Drafts awaiting approval</small></div><div class="metric"><span>Stock watch</span><strong class="num">${String(lowStock().length).padStart(2, '0')}</strong><small>SKUs at or below minimum</small></div></div>`;
  }
  function overview() {
    if (concept === 'folio') return folioOverview();
    return (
      pageHeading(
        'Overview',
        'The orders to move forward, and the stock to keep in view.',
        newOrderButton(),
      ) +
      metrics() +
      `<div class="overview-grid"><section><div class="section-heading"><div><h2>Needs your attention</h2><p class="muted">Start with the next actionable decision.</p></div><span class="badge">${drafts().length + confirmed().length + (state.failed ? 1 : 0)} items</span></div><div class="worklist">${drafts()
        .map(
          (o) =>
            `<article class="work-item"><span class="work-icon">${icon('ClipboardText')}</span><div><strong class="work-label">Review ${e(o.customer)}</strong><p>${orderNumber(o)} · ${o.lines.length} line items · ${money(total(o))}</p></div>${btn('Review order', 'order', `data-id="${o.id}"`)}</article>`,
        )
        .join('')}${confirmed()
        .map(
          (o) =>
            `<article class="work-item"><span class="work-icon info">${icon('Package')}</span><div><strong class="work-label">${e(o.customer)} is ready to fulfill</strong><p>${orderNumber(o)} · Stock reserved · ${money(total(o))}</p></div>${btn('Open order', 'order', `data-id="${o.id}"`)}</article>`,
        )
        .join(
          '',
        )}${state.failed ? `<article class="work-item"><span class="work-icon danger">${icon('PlugsConnected')}</span><div><strong class="work-label">Storefront order needs a retry</strong><p>Delivery failed · No draft created</p></div>${btn('Inspect', 'integration')}</article>` : ''}${!drafts().length && !confirmed().length && !state.failed ? '<div class="empty"><strong>Everything is up to date.</strong>No orders or integrations need attention.</div>' : ''}</div></section><aside><div class="section-heading"><h2>Stock watch</h2><button class="text-link" data-page="inventory">View inventory ${icon('ArrowUpRight')}</button></div>${
        lowStock()
          .map(
            (p) =>
              `<article class="stock-watch"><div class="stock-row"><button class="row-main" data-action="product" data-id="${p.id}">${e(p.name)}</button></div><div class="stock-meter" aria-hidden="true"><i style="width:${Math.min(100, (available(p) / p.min) * 100)}%"></i></div><div class="stock-meta"><span>${available(p)} ${p.unit} available</span><span>Minimum ${p.min}</span></div></article>`,
          )
          .join('') || '<p class="muted">All SKUs are above their minimum.</p>'
      }<div class="section-heading"><h2>Order flow</h2></div><div class="flow-summary"><div><strong>${confirmed().length}</strong><small>Ready to fulfill</small></div><div><strong>${orders.filter((o) => o.status === 'Fulfilled').length}</strong><small>Fulfilled</small></div></div><p class="muted" style="font-size:13px">Available = on hand − reserved.</p></aside></div><div class="overview-foot"><span class="muted">${orders.length} orders in the register · Main warehouse · USD</span><button class="text-link" data-page="orders">View all orders ${icon('ArrowUpRight')}</button></div>`
    );
  }
  function folioOverview() {
    return (
      pageHeading(
        'A clear path from order to delivery.',
        'Three places to focus. One connected workspace.',
        newOrderButton(),
        'HARBOR & PINE / WHOLESALE OPERATIONS',
      ) +
      `<div class="folio-workspace"><span>Main warehouse · USD · Manager view</span><span>Thursday, 22 October 2026</span></div>` +
      metrics() +
      `<div class="flow-board"><section class="flow-lane"><header class="lane-head"><h2><span class="lane-index">01</span>Review</h2><span>${drafts().length}</span></header><p class="lane-copy">Check the request. Reserve its stock.</p>${
        drafts()
          .map(
            (o) =>
              `<article class="flow-record"><div class="record-top"><span>${orderNumber(o)}</span><span>${o.date}</span></div><h3>${e(o.customer)}</h3><p>${o.lines.length} line items · Availability checked on confirm</p><div class="record-bottom"><strong class="num">${money(total(o))}</strong>${linkButton('Review order', 'order', `data-id="${o.id}"`)}</div></article>`,
          )
          .join('') || '<div class="empty">No drafts to review.</div>'
      }</section><section class="flow-lane"><header class="lane-head"><h2><span class="lane-index">02</span>Fulfill</h2><span>${confirmed().length}</span></header><p class="lane-copy">Stock is held. Complete the handoff.</p>${
        confirmed()
          .map(
            (o) =>
              `<article class="flow-record"><div class="record-top"><span>${orderNumber(o)}</span>${badge('Confirmed')}</div><h3>${e(o.customer)}</h3><p>${o.lines.reduce((n, l) => n + l.qty, 0)} units reserved for this order</p><div class="record-bottom"><strong class="num">${money(total(o))}</strong>${linkButton('Open order', 'order', `data-id="${o.id}"`)}</div></article>`,
          )
          .join('') ||
        '<div class="empty">No orders awaiting fulfillment.</div>'
      }</section><section class="flow-lane"><header class="lane-head"><h2><span class="lane-index">03</span>Replenish</h2><span>${lowStock().length}</span></header><p class="lane-copy">Keep the next order moving.</p>${
        lowStock()
          .map(
            (p) =>
              `<article class="flow-record"><div class="record-top"><span>${p.sku}</span>${badge('Low')}</div><h3>${e(p.name)}</h3><p>${available(p)} ${p.unit} available · Minimum ${p.min}</p><div class="record-bottom">${linkButton('View stock', 'product', `data-id="${p.id}"`)}${linkButton('Receive', 'receive', `data-id="${p.id}"`)}</div></article>`,
          )
          .join('') || '<div class="empty">All SKUs above minimum.</div>'
      }</section></div>${state.failed ? `<aside class="integration-strip"><div><strong>One storefront delivery needs attention.</strong><p>Inspect the error before retrying to create the missing draft.</p></div>${btn('Inspect delivery', 'integration')}</aside>` : ''}<div class="overview-foot"><span class="muted">${orders.length} orders in the register · Main warehouse · USD</span><button class="text-link" data-page="orders">View all orders ${icon('ArrowUpRight')}</button></div>`
    );
  }
  function orderTable(rows) {
    if (!rows.length)
      return '<div class="empty"><strong>No matching orders</strong>Try another search or status filter.</div>';
    return `<table class="plain-table"><caption class="sr-only">Sales orders</caption><thead><tr><th scope="col">Order / customer</th><th scope="col">Status</th><th scope="col">Created</th><th scope="col" class="numeric">Order value</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead><tbody>${rows.map((o) => `<tr><td><button class="row-main" data-action="order" data-id="${o.id}">${orderNumber(o)}</button><span class="row-sub">${e(o.customer)}</span></td><td>${badge(o.status)}</td><td class="muted">${o.date}, 2026</td><td class="numeric">${money(total(o))}</td><td class="numeric"><button class="icon-btn" aria-label="Open ${orderNumber(o)}" data-action="order" data-id="${o.id}">${icon('ArrowRight')}</button></td></tr>`).join('')}</tbody></table><div class="mobile-cards">${rows.map((o) => `<article class="mobile-record"><div class="record-top"><span>${orderNumber(o)}</span>${badge(o.status)}</div><button class="row-main" data-action="order" data-id="${o.id}">${e(o.customer)}</button><div class="record-bottom"><span class="num">${money(total(o))}</span>${linkButton('Open order', 'order', `data-id="${o.id}"`)}</div></article>`).join('')}</div>`;
  }
  function visibleOrders() {
    const q = state.query.toLowerCase();
    return orders.filter(
      (o) =>
        (state.filter === 'All' || o.status === state.filter) &&
        `${orderNumber(o)} ${o.customer}`.toLowerCase().includes(q),
    );
  }
  function orderFilters() {
    return `<div class="filters" aria-label="Order status filter">${['All', 'Draft', 'Confirmed', 'Fulfilled'].map((status) => `<button class="filter-tab" aria-pressed="${state.filter === status}" data-filter="${status}">${status === 'Confirmed' ? 'To fulfill' : status} <span>${status === 'All' ? orders.length : orders.filter((o) => o.status === status).length}</span></button>`).join('')}</div><div class="toolbar"><label class="search-field">${icon('MagnifyingGlass')}<span class="sr-only">Search orders</span><input id="list-search" type="search" value="${e(state.query)}" placeholder="Search order or customer…" autocomplete="off"></label><span class="muted" style="font-size:12px">Main warehouse · USD</span></div>`;
  }
  function ordersPage() {
    return (
      pageHeading(
        'Sales orders',
        concept === 'relay'
          ? 'Move through the queue. Keep the full order in view.'
          : 'Review requests, reserve stock and follow every handoff.',
        newOrderButton(),
      ) +
      orderFilters() +
      `<div id="list-results">${orderResults()}</div>`
    );
  }
  function orderResults() {
    const rows = visibleOrders();
    if (concept !== 'relay')
      return (
        orderTable(rows) +
        `<p class="list-caption">${rows.length} of ${orders.length} orders · All values in USD</p>`
      );
    if (!rows.length)
      return '<div class="empty"><strong>No matching orders</strong>Try another search or filter.</div>';
    if (!rows.some((o) => o.id === state.selected)) state.selected = rows[0].id;
    return `<div class="queue-layout"><section class="queue" aria-label="Order queue"><div class="queue-title"><span>${rows.length} orders in this view</span><span>USD</span></div>${rows.map((o) => `<button class="queue-item" data-action="select-order" data-id="${o.id}" aria-pressed="${o.id === state.selected}"><span class="queue-id"><span>${orderNumber(o)}</span><span>${o.date}</span></span><strong>${e(o.customer)}</strong><span class="queue-foot">${badge(o.status)}<span class="num">${money(total(o))}</span></span></button>`).join('')}</section><article class="queue-object" aria-label="Selected order">${orderDetail(order(state.selected))}</article></div>`;
  }
  function inventoryPage() {
    return (
      pageHeading(
        'Inventory',
        'Know what is on hand, what is reserved and what you can promise.',
        receiveButton(),
      ) +
      `<div class="metric-strip"><div class="metric"><span>Active SKUs</span><strong>${products.length}</strong><small>Single warehouse</small></div><div class="metric"><span>Available units</span><strong>${products.reduce((n, p) => n + available(p), 0)}</strong><small>On hand minus reserved</small></div><div class="metric"><span>Stock watch</span><strong>${lowStock().length}</strong><small>At or below minimum</small></div></div><div class="filters" aria-label="Stock filter">${['All', 'Low'].map((status) => `<button class="filter-tab" data-filter="${status}" aria-pressed="${state.filter === status}">${status === 'All' ? 'All inventory' : 'Stock watch'} <span>${status === 'All' ? products.length : lowStock().length}</span></button>`).join('')}</div><div class="toolbar"><label class="search-field">${icon('MagnifyingGlass')}<span class="sr-only">Search inventory</span><input id="list-search" type="search" value="${e(state.query)}" placeholder="Search SKU or product…" autocomplete="off"></label><span class="muted" style="font-size:12px">Main warehouse · Quantities in base units</span></div><div id="list-results">${inventoryResults()}</div>`
    );
  }
  function inventoryResults() {
    const rows = products.filter(
      (p) =>
        (state.filter !== 'Low' || available(p) <= p.min) &&
        `${p.name} ${p.sku}`.toLowerCase().includes(state.query.toLowerCase()),
    );
    if (!rows.length)
      return '<div class="empty"><strong>No matching inventory</strong>Try another SKU or clear the stock filter.</div>';
    return `<table class="plain-table"><caption class="sr-only">Inventory balances; available equals on hand minus reserved</caption><thead><tr><th scope="col">Product / SKU</th><th scope="col" class="numeric">On hand</th><th scope="col" class="numeric">Reserved</th><th scope="col" class="numeric">Available</th><th scope="col">Stock status</th></tr></thead><tbody>${rows.map((p) => `<tr><td><button class="row-main" data-action="product" data-id="${p.id}">${e(p.name)}</button><span class="row-sub">${p.sku} · ${p.unit}</span></td><td class="numeric">${p.onHand}</td><td class="numeric">${p.reserved}</td><td class="numeric"><strong>${available(p)}</strong></td><td>${badge(available(p) <= p.min ? 'Low' : 'Healthy')}</td></tr>`).join('')}</tbody></table><div class="mobile-cards">${rows.map((p) => `<article class="mobile-record"><div class="record-top"><span>${p.sku}</span>${badge(available(p) <= p.min ? 'Low' : 'Healthy')}</div><button class="row-main" data-action="product" data-id="${p.id}">${e(p.name)}</button><div class="record-bottom"><span><strong>${available(p)}</strong> available <small class="muted">/ ${p.onHand} on hand</small></span>${linkButton('View', 'product', `data-id="${p.id}"`)}</div></article>`).join('')}</div><p class="list-caption">${rows.length} of ${products.length} active SKUs · Select a product to explain its stock balance</p>`;
  }
  function orderDetail(o, modal = false) {
    const canConfirm =
      o.status === 'Draft' &&
      o.lines.every((l) => available(product(l.product)) >= l.qty);
    const nextAction =
      o.status === 'Draft'
        ? btn(
            'Confirm order',
            'transition',
            `data-id="${o.id}" ${canConfirm ? '' : 'disabled'}`,
            'primary',
          )
        : o.status === 'Confirmed'
          ? btn('Mark fulfilled', 'transition', `data-id="${o.id}"`, 'primary')
          : '';
    return `<div class="object-eyebrow"><span>SALES ORDER / ${orderNumber(o)}</span>${modal ? '' : badge(o.status)}</div><div class="object-title"><div><h2 ${modal ? 'id="detail-title"' : ''}>${e(o.customer)}</h2><p>${orderNumber(o)}</p></div>${modal ? badge(o.status) : nextAction}</div><dl class="object-facts"><div><dt>Created</dt><dd>${o.date}, 2026</dd></div><div><dt>Warehouse</dt><dd>Main warehouse</dd></div><div><dt>Currency</dt><dd>USD</dd></div></dl>${orderProgress(o)}<section class="object-section"><h3>Order items</h3><table class="plain-table"><caption class="sr-only">Order line items</caption><thead><tr><th scope="col">Product</th><th scope="col" class="numeric">Qty</th><th scope="col" class="numeric mobile-hide">Price</th><th scope="col" class="numeric">Amount</th></tr></thead><tbody>${o.lines.map((l) => `<tr><td><strong>${e(product(l.product).name)}</strong><span class="row-sub">${product(l.product).sku}</span>${lineStock(o, l)}</td><td class="numeric">${l.qty}</td><td class="numeric mobile-hide">${money(product(l.product).price)}</td><td class="numeric">${money(l.qty * product(l.product).price)}</td></tr>`).join('')}</tbody></table><div class="mobile-cards">${o.lines.map((l) => `<div class="math-row"><span>${e(product(l.product).name)} × ${l.qty}${lineStock(o, l)}</span><strong>${money(l.qty * product(l.product).price)}</strong></div>`).join('')}</div><div class="math-row total"><strong>Order total</strong><strong class="num">${money(total(o))}</strong></div></section>${o.status === 'Draft' ? `<div class="availability ${canConfirm ? '' : 'warning'}">${icon(canConfirm ? 'CheckCircle' : 'Warning')}<span><strong>${canConfirm ? 'Stock available for all items.' : 'Insufficient available stock.'}</strong><br>${canConfirm ? 'Confirm to reserve these quantities for this order.' : 'Receive stock before confirming this order.'}</span></div>` : o.status === 'Confirmed' ? `<div class="availability">${icon('CheckCircle')}<span><strong>Stock is reserved for this order.</strong><br>Fulfillment deducts the reserved quantities from on-hand stock.</span></div>` : ''}<details class="object-section order-activity"><summary>Activity</summary><div class="activity-line">${icon('Clock')}<span>Created as a draft · ${o.date}, 2026</span></div>${o.status !== 'Draft' ? `<div class="activity-line">${icon(o.status === 'Cancelled' ? 'Info' : 'CheckCircle')}<span>Current state: ${o.status}</span></div>` : ''}</details><footer class="object-footer"><small>${o.status === 'Draft' ? 'Review item quantities and customer before confirming.' : o.status === 'Confirmed' ? 'Mark fulfilled after all items leave the warehouse.' : 'This order is closed. No stock action is available.'}</small>${modal ? nextAction : ''}</footer>`;
  }
  function showDetail(html, context = 'Order details') {
    const search = document.getElementById('command-dialog');
    if (search.open) search.close();
    const dialog = document.getElementById('detail');
    dialog.innerHTML = `<header class="dialog-header"><span class="muted">${context}</span><button class="icon-btn" aria-label="Close details" data-close="detail">${icon('X')}</button></header><div class="dialog-content">${html}</div>`;
    const footer = dialog.querySelector('.object-footer');
    if (footer) dialog.append(footer);
    if (!dialog.open) dialog.showModal();
    else {
      const title = dialog.querySelector('#detail-title');
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
  }
  function openOrder(id) {
    showDetail(orderDetail(order(id), true));
  }

  function orderProgress(o) {
    const steps = ['Draft', 'Confirmed', 'Fulfilled'];
    const current = steps.indexOf(o.status);
    if (current < 0)
      return `<p class="order-closed">This order was cancelled. No stock is held.</p>`;
    return `<ol class="order-progress" aria-label="Order progress">${steps.map((step, index) => `<li class="${index < current ? 'complete' : ''}" ${index === current ? 'aria-current="step"' : ''}><span>${index < current ? icon('CheckCircle') : String(index + 1).padStart(2, '0')}</span><div><strong>${step}</strong><small>${['Review the request', 'Stock is reserved', 'Stock has left'][index]}</small></div></li>`).join('')}</ol>`;
  }

  function lineStock(o, line) {
    const p = product(line.product);
    if (o.status === 'Draft') {
      const ready = available(p) >= line.qty;
      return `<small class="line-stock ${ready ? '' : 'short'}">${icon(ready ? 'CheckCircle' : 'Warning')}${available(p)} available${ready ? '' : ` · Short by ${line.qty - available(p)}`}</small>`;
    }
    return `<small class="line-stock">${o.status === 'Confirmed' ? `${line.qty} ${p.unit} reserved for this order` : o.status === 'Fulfilled' ? `${line.qty} ${p.unit} fulfilled` : 'No reservation'}</small>`;
  }

  function stockImpact(o) {
    const isConfirm = o.status === 'Draft';
    return `<section class="stock-impact" aria-labelledby="impact-heading"><h3 id="impact-heading">Stock after ${isConfirm ? 'confirmation' : 'fulfillment'}</h3><p>Preview the change in Main warehouse.</p>${o.lines
      .map((line) => {
        const p = product(line.product);
        const hand = p.onHand - (isConfirm ? 0 : line.qty);
        const reserved = p.reserved + (isConfirm ? line.qty : -line.qty);
        return `<div class="impact-product"><strong>${e(p.name)}</strong><span class="muted">${p.sku} · ${line.qty} ${p.unit}</span><dl><div><dt>On hand</dt><dd>${p.onHand} ${icon('ArrowRight')} <strong>${hand}</strong></dd></div><div><dt>Reserved</dt><dd>${p.reserved} ${icon('ArrowRight')} <strong>${reserved}</strong></dd></div><div><dt>Available</dt><dd>${available(p)} ${icon('ArrowRight')} <strong>${hand - reserved}</strong></dd></div></dl></div>`;
      })
      .join('')}</section>`;
  }

  function receiptsPage() {
    return (
      pageHeading(
        'Receipts',
        'Record what arrived. Keep each stock increase linked to its supplier.',
        receiveButton(),
      ) +
      `<div class="toolbar"><label class="search-field">${icon('MagnifyingGlass')}<span class="sr-only">Search receipts</span><input id="list-search" type="search" value="${e(state.query)}" placeholder="Search receipt, reference or supplier…" autocomplete="off"></label><span class="list-context">${receipts.length} recorded in this preview</span></div><div id="list-results" class="receipt-results">${receiptResults()}</div>`
    );
  }

  function receiptResults() {
    const rows = receipts.filter((r) =>
      `${receiptNumber(r)} ${r.reference} ${r.supplier} ${product(r.product).name}`
        .toLowerCase()
        .includes(state.query.toLowerCase()),
    );
    if (!rows.length)
      return `<div class="receipt-empty"><span>${icon('Receipt')}</span><h2>${receipts.length ? 'No matching receipts' : 'Give every delivery a record.'}</h2><p>${receipts.length ? 'Try a supplier name or clear the search.' : 'Receive a delivery to create its receipt. Stock on hand updates as soon as you apply it.'}</p>${receipts.length ? '' : btn('Record a receipt', 'receive', 'data-id="3"')}</div>`;
    return `<table class="plain-table"><caption class="sr-only">Recorded stock receipts</caption><thead><tr><th scope="col">Receipt / reference</th><th scope="col">Supplier</th><th scope="col">Product</th><th scope="col" class="numeric">Received</th></tr></thead><tbody>${rows.map((r) => `<tr><td><button class="row-main" data-action="receipt" data-id="${r.id}">${receiptNumber(r)}</button><span class="row-sub">${e(r.reference)}</span></td><td>${e(r.supplier)}</td><td>${e(product(r.product).name)}<span class="row-sub">${product(r.product).sku}</span></td><td class="numeric"><strong>+${r.qty}</strong> <span class="muted">${product(r.product).unit}</span></td></tr>`).join('')}</tbody></table><div class="mobile-cards">${rows.map((r) => `<article class="mobile-record"><div class="record-top"><button class="row-main" data-action="receipt" data-id="${r.id}">${receiptNumber(r)}</button><span>+${r.qty} ${product(r.product).unit}</span></div><strong>${e(r.supplier)}</strong><p>${e(product(r.product).name)}</p><div class="record-bottom"><span class="muted">${e(r.reference)}</span>${linkButton('View receipt', 'receipt', `data-id="${r.id}"`)}</div></article>`).join('')}</div><p class="list-caption">${rows.length} of ${receipts.length} receipts · Opening balances are part of the sample snapshot</p>`;
  }

  function openReceipt(id) {
    const r = receipts.find((item) => item.id === id);
    if (!r) return;
    const p = product(r.product);
    showDetail(
      `<div class="object-eyebrow">STOCK RECEIPT / ${receiptNumber(r)}</div><div class="object-title"><div><h2 id="detail-title">${e(r.supplier)}</h2><p>${receiptNumber(r)}</p></div><span class="badge healthy">Recorded</span></div><dl class="object-facts"><div><dt>Supplier reference</dt><dd>${e(r.reference)}</dd></div><div><dt>Warehouse</dt><dd>Main warehouse</dd></div><div><dt>Added</dt><dd>In this preview</dd></div></dl><section class="object-section"><h3>Received item</h3><div class="receipt-item"><span class="item-illustration">${icon('Package')}</span><div><strong>${e(p.name)}</strong><span class="row-sub">${p.sku}</span></div><strong>+${r.qty} ${p.unit}</strong></div></section><section class="object-section"><h3>Recorded stock change</h3><div class="receipt-snapshot"><span>On hand <strong>${r.before} ${icon('ArrowRight')} ${r.before + r.qty}</strong></span><span>Reserved <strong>${r.reserved} ${icon('ArrowRight')} ${r.reserved}</strong></span></div><p class="muted">Reservations stayed allocated. This is the balance at the time of receipt.</p></section><footer class="object-footer"><small>Open the product to inspect its current balance.</small>${linkButton('View current stock', 'product', `data-id="${p.id}"`)}</footer>`,
      'Receipt details',
    );
  }

  function openSearch() {
    const detail = document.getElementById('detail');
    if (detail.open) detail.close();
    const dialog = document.getElementById('command-dialog');
    if (dialog.open) {
      dialog.close();
      return;
    }
    dialog.innerHTML = `<header class="command-header"><h2 id="command-title" class="sr-only">Search workspace</h2><label>${icon('MagnifyingGlass')}<span class="sr-only">Search orders and products</span><input id="command-search" type="search" placeholder="Search an order, customer, product or SKU…" autocomplete="off"></label><button class="icon-btn" data-close="command-dialog" aria-label="Close search">${icon('X')}</button></header><div id="command-results" class="command-results"></div><footer class="command-footer"><span>Enter opens the first result</span><span>Esc to close</span></footer>`;
    renderSearch('');
    dialog.showModal();
    document.getElementById('command-search').focus();
  }

  function renderSearch(query) {
    const q = query.trim().toLowerCase();
    const foundOrders = orders
      .filter(
        (o) =>
          `${orderNumber(o)} ${o.customer} ${o.lines.map((l) => `${product(l.product).sku} ${product(l.product).name}`).join(' ')}`
            .toLowerCase()
            .includes(q) &&
          (q || ['Draft', 'Confirmed'].includes(o.status)),
      )
      .slice(0, 6);
    const foundProducts = products
      .filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(q))
      .slice(0, q ? 8 : 3);
    document.getElementById('command-results').innerHTML =
      `${foundOrders.length ? `<section><h3>Orders</h3>${foundOrders.map((o) => `<button class="command-result" data-action="order" data-id="${o.id}"><span class="command-glyph">${icon('ClipboardText')}</span><span><strong>${e(o.customer)}</strong><small>${orderNumber(o)}</small></span>${badge(o.status)}${icon('ArrowUpRight')}</button>`).join('')}</section>` : ''}${foundProducts.length ? `<section><h3>Products & inventory</h3>${foundProducts.map((p) => `<button class="command-result" data-action="product" data-id="${p.id}"><span class="command-glyph">${icon('Cube')}</span><span><strong>${e(p.name)}</strong><small>${p.sku} · ${available(p)} ${p.unit} available</small></span>${icon('ArrowUpRight')}</button>`).join('')}</section>` : ''}${!foundOrders.length && !foundProducts.length ? '<div class="empty"><strong>No results in this workspace</strong>Try an order number, customer name or SKU.</div>' : ''}`;
  }
  function openProduct(id) {
    const p = product(id);
    const reservations = confirmed().flatMap((o) =>
      o.lines.filter((l) => l.product === p.id).map((l) => ({ o, qty: l.qty })),
    );
    showDetail(
      `<div class="object-eyebrow">${p.sku} / STOCK EXPLANATION</div><h2 id="detail-title">${e(p.name)}</h2><p class="muted" style="margin-top:8px">Main warehouse · Unit: ${p.unit}</p><div class="stock-equation" aria-label="${p.onHand} on hand minus ${p.reserved} reserved equals ${available(p)} available"><div><strong>${p.onHand}</strong><small>On hand</small></div><span>−</span><div><strong>${p.reserved}</strong><small>Reserved</small></div><span>=</span><div><strong>${available(p)}</strong><small>Available</small></div></div>${available(p) <= p.min ? `<div class="availability warning">${icon('Warning')}<span>At or below the minimum of ${p.min}. Receive stock to replenish this SKU.</span></div>` : ''}<section class="object-section"><h3>Orders holding stock</h3>${reservations.map((r) => `<div class="math-row">${linkButton(orderNumber(r.o), 'order', `data-id="${r.o.id}"`)}<strong>${r.qty} ${p.unit}</strong></div>`).join('') || '<p class="muted" style="font-size:14px">No confirmed orders currently reserve this SKU.</p>'}</section><section class="object-section"><h3>How this balance works</h3><p class="muted" style="font-size:14px">Receipts increase on-hand stock. Confirmed orders reserve stock. Fulfillment decreases on-hand and reserved stock together. Reservations are shown separately from the movement ledger.</p></section><footer class="object-footer"><small>Receive only quantities physically delivered.</small>${receiveButton(p.id)}</footer>`,
      'Inventory details',
    );
  }
  function formDialog(title, body, action) {
    const dialog = document.getElementById('form-dialog');
    dialog.innerHTML = `<form id="prototype-form" data-form="${action}"><header class="dialog-header"><h2 id="form-title">${title}</h2><button type="button" class="icon-btn" aria-label="Close form" data-close="form-dialog">${icon('X')}</button></header><div class="dialog-content">${body}</div><footer class="dialog-actions"><span class="local-label">Simulation only · No server writes</span><button type="button" class="btn" data-close="form-dialog">Cancel</button><button type="submit" class="btn primary">${action === 'new-order' ? 'Create draft' : 'Apply receipt'}</button></footer></form>`;
    dialog.showModal();
  }
  function openCreateOrder() {
    formDialog(
      'New sales order',
      `<p>Start with a draft. Stock is reserved when the order is confirmed.</p><div class="form-grid"><label class="field full">Customer<select name="customer">${['Cedar Street Market', 'Northstar Office Supply', 'Bluebird Hospitality', 'Goodship Retail Co.', 'Atlas Facilities Group'].map((n) => `<option>${n}</option>`).join('')}</select></label><label class="field full">Product<select id="form-product" name="product">${products.map((p) => `<option value="${p.id}">${p.name} · ${p.sku}</option>`).join('')}</select></label><label class="field">Quantity<input id="form-quantity" name="quantity" type="number" value="1" min="1" max="10000" step="1" required></label><div class="field"><span>Unit price</span><strong id="unit-price" style="padding:10px 0">${money(products[0].price)}</strong></div></div><div class="math-row total"><strong>Draft total</strong><strong id="form-total">${money(products[0].price)}</strong></div><p class="muted" style="font-size:12px;margin-top:15px">This prototype demonstrates one line per new draft. The final app keeps its existing multi-line editor.</p>`,
      'new-order',
    );
  }
  function openReceive(id) {
    if (document.getElementById('detail').open)
      document.getElementById('detail').close();
    const p = product(id);
    formDialog(
      'Receive stock',
      `<p>Record the quantities physically delivered by your supplier.</p><div class="form-grid"><label class="field full">Product<select id="receipt-product" name="product">${products.map((item) => `<option value="${item.id}" ${item.id === p.id ? 'selected' : ''}>${e(item.name)} · ${item.sku}</option>`).join('')}</select></label><p id="receipt-current" class="receipt-current full">${p.onHand} ${p.unit} on hand · ${p.reserved} reserved · ${available(p)} available</p><label class="field full">Supplier<select name="supplier"><option>Harbor Packaging Supply</option><option>Pacific Trade Co.</option><option>Northline Materials</option></select></label><label class="field">Quantity received<input name="quantity" type="number" value="10" min="1" max="10000" step="1" required></label><label class="field">Supplier reference<input name="reference" placeholder="e.g. DN-2026-042" maxlength="80" required></label></div><div class="availability">${icon('Info')}<span>On-hand stock increases. Existing reservations stay allocated. A receipt document records the change.</span></div>`,
      'receive',
    );
  }
  function openConfirmation(o) {
    const isConfirm = o.status === 'Draft';
    const dialog = document.getElementById('confirmation');
    dialog.innerHTML = `<header class="dialog-header"><h2 id="confirm-title">${isConfirm ? 'Confirm order?' : 'Mark order fulfilled?'}</h2><button class="icon-btn" aria-label="Close confirmation" data-close="confirmation">${icon('X')}</button></header><div class="dialog-content"><p><strong>${orderNumber(o)} · ${e(o.customer)}</strong></p><p>${isConfirm ? 'This reserves the order quantities so another order cannot use them.' : 'This records all order items leaving the warehouse and releases their reservations.'}</p><div class="math-row total"><span>Order value</span><strong>${money(total(o))}</strong></div>${stockImpact(o)}</div><footer class="dialog-actions"><span class="local-label">Prototype simulation</span>${btn('Go back', 'close-confirm')}${btn(isConfirm ? 'Confirm & reserve' : 'Mark fulfilled', 'apply-transition', '', 'primary')}</footer>`;
    confirmAction = () => {
      if (!['Draft', 'Confirmed'].includes(o.status)) return;
      if (
        isConfirm &&
        !o.lines.every((l) => available(product(l.product)) >= l.qty)
      ) {
        toast('Not enough available stock. Receive stock first.');
        return;
      }
      for (const l of o.lines) {
        const p = product(l.product);
        if (isConfirm) p.reserved += l.qty;
        else {
          p.reserved -= l.qty;
          p.onHand -= l.qty;
        }
      }
      o.status = isConfirm ? 'Confirmed' : 'Fulfilled';
      document.getElementById('confirmation').close();
      const keepInspector = document.getElementById('detail').open;
      if (keepInspector) document.getElementById('detail').close();
      shell();
      if (keepInspector) openOrder(o.id);
      else document.getElementById('main').focus({ preventScroll: true });
      toast(
        `${orderNumber(o)} ${isConfirm ? 'confirmed; stock reserved' : 'fulfilled; stock updated'} in this preview.`,
      );
    };
    dialog.showModal();
  }
  function openIntegration() {
    showDetail(
      `<div class="object-eyebrow">INTEGRATION DELIVERY</div><h2 id="detail-title">Storefront order</h2><p class="muted" style="margin-top:8px">storefront-demo-failure-001</p><section class="object-section">${badge(state.failed ? 'Failed' : 'Succeeded')}<div class="availability ${state.failed ? 'warning' : ''}">${icon(state.failed ? 'Warning' : 'CheckCircle')}<span>${state.failed ? 'Processing was interrupted. No draft was created. Inspect the payload, then retry this delivery.' : 'The simulated retry created one draft order. Open Orders to inspect it.'}</span></div></section><dl class="object-facts"><div><dt>Event</dt><dd>order.created</dd></div><div><dt>Source</dt><dd>Mock storefront</dd></div><div><dt>Outcome</dt><dd>${state.failed ? 'No draft created' : 'Draft created'}</dd></div></dl><section class="object-section"><h3>Payload summary</h3><p class="muted" style="font-size:14px">Northstar Office Supply · Padded Mailer Medium × 4 · ${money(10)}</p></section><footer class="object-footer"><small>Local simulation. The final app uses its existing safe retry command.</small>${state.failed ? btn('Retry delivery', 'retry', '', 'primary') : ''}</footer>`,
      'Integration details',
    );
  }
  function openInfo(name) {
    const content = {
      Products: 'Product catalog, active / inactive state, SKU and pricing.',
      Partners:
        'Customer and supplier lists, contact details and linked documents.',
      Receipts:
        'Receipt documents with supplier, line quantities and stock movement links.',
      Settings:
        'Workspace details, team, invitations, billing and role-based controls.',
      More: 'Products, partners, receipts, imports, integrations, audit and workspace settings.',
    };
    showDetail(
      `<div class="object-eyebrow">V2 / SUPPORTING MODULE</div><h2 id="detail-title">${e(name)}</h2><section class="object-section"><p class="muted">${content[name] || ''}</p></section><section class="object-section"><h3>Included in the full redesign</h3><p class="muted" style="margin-top:10px">This exploration covers Overview, Orders, Inventory and Receipts. You can review the working flow before applying the full redesign. Supporting modules will follow the selected system.</p></section>${name === 'More' ? nav.map(([key, label]) => `<p><button class="text-link" data-page="${key}">${label} ${icon('ArrowRight')}</button></p>`).join('') : ''}`,
      'Prototype scope',
    );
  }
  function toast(message) {
    clearTimeout(toastTimer);
    document.getElementById('toast-region').innerHTML =
      `<div class="toast">${e(message)}</div>`;
    toastTimer = setTimeout(() => {
      const region = document.getElementById('toast-region');
      if (region) region.innerHTML = '';
    }, 5000);
  }
  root.addEventListener('click', (event) => {
    const close = event.target.closest('[data-close]');
    if (close) {
      document.getElementById(close.dataset.close).close();
      return;
    }
    const page = event.target.closest('[data-page]');
    if (page) {
      state.page = page.dataset.page;
      state.filter = 'All';
      state.query = '';
      shell();
      document.getElementById('main').focus({ preventScroll: true });
      return;
    }
    const filter = event.target.closest('[data-filter]');
    if (filter) {
      state.filter = filter.dataset.filter;
      renderMain();
      document
        .querySelector(`[data-filter="${state.filter}"]`)
        ?.focus({ preventScroll: true });
      return;
    }
    const info = event.target.closest('[data-info]');
    if (info) {
      openInfo(info.dataset.info);
      return;
    }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const id = Number(action.dataset.id);
    switch (action.dataset.action) {
      case 'new-order':
        openCreateOrder();
        break;
      case 'receive':
        openReceive(id);
        break;
      case 'order':
        openOrder(id);
        break;
      case 'receipt':
        openReceipt(id);
        break;
      case 'product':
        openProduct(id);
        break;
      case 'select-order':
        state.selected = id;
        if (matchMedia('(max-width:620px)').matches) openOrder(id);
        else {
          document.getElementById('list-results').innerHTML = orderResults();
          document
            .querySelector(`[data-action="select-order"][data-id="${id}"]`)
            ?.focus({ preventScroll: true });
        }
        break;
      case 'transition':
        openConfirmation(order(id));
        break;
      case 'apply-transition':
        if (confirmAction) confirmAction();
        break;
      case 'close-confirm':
        document.getElementById('confirmation').close();
        break;
      case 'integration':
        openIntegration();
        break;
      case 'retry':
        if (!state.failed) break;
        state.failed = false;
        orders.unshift({
          id: nextOrderId(),
          customer: 'Northstar Office Supply',
          status: 'Draft',
          date: 'Oct 22',
          lines: [{ product: 1, qty: 4 }],
        });
        document.getElementById('detail').close();
        shell();
        document.getElementById('main').focus({ preventScroll: true });
        toast('Delivery retried. One draft created in this preview.');
        break;
      case 'search':
        openSearch();
        break;
    }
  });
  root.addEventListener('input', (event) => {
    if (event.target.id === 'command-search') renderSearch(event.target.value);
    if (event.target.name === 'reference') event.target.setCustomValidity('');
    if (event.target.id === 'receipt-product') {
      const p = product(event.target.value);
      document.getElementById('receipt-current').textContent =
        `${p.onHand} ${p.unit} on hand · ${p.reserved} reserved · ${available(p)} available`;
    }
    if (event.target.id === 'list-search') {
      state.query = event.target.value;
      document.getElementById('list-results').innerHTML =
        state.page === 'orders'
          ? orderResults()
          : state.page === 'receipts'
            ? receiptResults()
            : inventoryResults();
    }
    if (['form-product', 'form-quantity'].includes(event.target.id))
      updateFormTotal();
  });
  function updateFormTotal() {
    const p = product(document.getElementById('form-product').value);
    document.getElementById('unit-price').textContent = money(p.price);
    document.getElementById('form-total').textContent = money(
      p.price * Number(document.getElementById('form-quantity').value),
    );
  }
  function nextOrderId() {
    return Math.max(...orders.map((o) => o.id)) + 1;
  }
  root.addEventListener('submit', (event) => {
    if (event.target.id !== 'prototype-form') return;
    event.preventDefault();
    const form = event.target;
    const values = new FormData(form);
    const qty = Number(values.get('quantity'));
    const p = product(values.get('product'));
    if (!Number.isInteger(qty) || qty < 1 || qty > 10000 || !p) return;
    if (form.dataset.form === 'new-order') {
      orders.unshift({
        id: nextOrderId(),
        customer: String(values.get('customer')),
        status: 'Draft',
        date: 'Oct 22',
        lines: [{ product: p.id, qty }],
      });
      state.page = 'orders';
      state.filter = 'Draft';
      state.query = '';
      state.selected = orders[0].id;
      document.getElementById('form-dialog').close();
      shell();
      document.getElementById('main').focus({ preventScroll: true });
      toast('Draft created in this preview. Stock has not been reserved.');
    } else {
      const reference = String(values.get('reference')).trim();
      if (!reference) {
        const input = form.elements.namedItem('reference');
        input.setCustomValidity('Enter a supplier reference.');
        input.reportValidity();
        return;
      }
      receipts.unshift({
        id: ++state.receiptCount,
        product: p.id,
        qty,
        reference,
        supplier: String(values.get('supplier')),
        before: p.onHand,
        reserved: p.reserved,
      });
      p.onHand += qty;
      document.getElementById('form-dialog').close();
      shell();
      document.getElementById('main').focus({ preventScroll: true });
      toast(`Receipt applied in this preview: +${qty} ${p.unit} of ${p.name}.`);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (
      event.key === 'Escape' &&
      document.getElementById('command-dialog').open
    ) {
      event.preventDefault();
      document.getElementById('command-dialog').close();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (
        document.getElementById('form-dialog').open ||
        document.getElementById('confirmation').open
      )
        return;
      openSearch();
    }
    if (event.target.id === 'command-search' && event.key === 'Enter') {
      event.preventDefault();
      document.querySelector('#command-results [data-action]')?.click();
    }
  });
  shell();
}
