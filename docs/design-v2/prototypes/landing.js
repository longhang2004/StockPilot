/* global window, document */
'use strict';

window.renderStockPilotLanding = function (root, params, icon) {
  const concept = ['atlas', 'relay', 'folio'].includes(params.get('preview'))
    ? params.get('preview')
    : 'atlas';
  const appUrl = `index.html?preview=${concept}`;
  const workspaceUrl = `${appUrl}${concept === 'relay' ? '&screen=orders' : ''}`;
  const brand = `<a href="index.html?preview=${concept}&surface=landing" class="brand" aria-label="StockPilot home"><span class="brand-symbol">${icon('Stack')}</span><span class="brand-name">StockPilot</span></a>`;
  const screenshots = {
    overview: [
      'Your next decisions, in one view.',
      'Orders waiting for review, stock approaching its minimum and the next handoff.',
      'Overview',
    ],
    orders: [
      'From request to a completed order.',
      'Review the items, confirm availability and follow the order through fulfillment.',
      'Orders',
    ],
    inventory: [
      'Know what you can promise.',
      'Keep on-hand, reserved and available quantities separate. Open a SKU to understand its balance.',
      'Inventory',
    ],
  };
  document.documentElement.lang = 'en';
  document.title = 'StockPilot — Clear inventory. Confident orders.';
  root.innerHTML = `<div class="app ${concept} landing-page"><a class="skip" href="#landing-main">Skip to content</a><header class="landing-header">${brand}<nav aria-label="Product navigation"><a href="#product-tour">Product</a><a href="#workflow">How it works</a></nav><a class="btn primary" href="${workspaceUrl}">Explore demo ${icon('ArrowUpRight')}</a></header><main id="landing-main" tabindex="-1"><section class="landing-hero"><div class="hero-map" aria-hidden="true"><canvas class="hero-canvas"></canvas></div><div class="hero-content"><p class="landing-audience">Inventory & orders for small wholesale teams</p><h1>Know your stock.<br><span>Keep orders moving.</span></h1><p class="landing-intro">A clear workspace for receiving stock, reviewing B2B orders<br class="desktop-break"> and keeping every handoff in view.</p><div class="landing-actions"><a class="btn primary" href="${workspaceUrl}">Explore the workspace ${icon('ArrowRight')}</a><a class="btn" href="#workflow">See how it works</a></div><p class="landing-demo-note">Interactive prototype <span>·</span> Sample data <span>·</span> No account needed</p></div><div class="map-caption" aria-hidden="true"><span>Illustrative logistics network</span><span>Warehouses · Orders in transit</span></div><button type="button" class="motion-toggle" hidden aria-label="Pause logistics animation"><svg viewBox="0 0 16 16" aria-hidden="true"><path class="motion-pause" d="M5 3v10M11 3v10"/><path class="motion-play" d="m5 3 8 5-8 5Z"/></svg><span>Pause motion</span></button></section><section class="product-tour" id="product-tour" aria-labelledby="tour-heading"><div class="tour-topline"><h2 id="tour-heading">One workspace. The full picture.</h2><span>Harbor & Pine · Demo workspace</span></div><div class="tour-frame"><div class="tour-tabs" aria-label="Product preview"><div>${Object.entries(
    screenshots,
  )
    .map(
      ([key, value]) =>
        `<button type="button" data-tour="${key}" aria-pressed="${key === 'overview'}">${icon(key === 'overview' ? 'SquaresFour' : key === 'orders' ? 'ClipboardText' : 'Cube')}${value[2]}</button>`,
    )
    .join(
      '',
    )}</div><a href="${appUrl}" id="tour-open">Open demo ${icon('ArrowUpRight')}</a></div><a href="${appUrl}" id="tour-image-link" aria-label="Open the interactive Overview prototype"><img id="tour-image" src="assets/${concept}-overview.png?v=workspace-20261023" alt="Actual StockPilot prototype: orders needing attention and low-stock products in the ${concept} style." width="1440" height="960" fetchpriority="high"></a></div><div class="tour-caption"><div><h3 id="tour-caption-title">${screenshots.overview[0]}</h3><p id="tour-caption-copy">${screenshots.overview[1]}</p></div><span class="tour-caption-note">Captured from this prototype<br>Changes in the demo stay local.</span></div></section><section class="landing-benefits" aria-label="What stays connected"><article><span class="benefit-icon">${icon('Cube')}</span><h2>Stock you can explain.</h2><p>On hand, reserved and available. See the orders behind every commitment.</p></article><article><span class="benefit-icon">${icon('ClipboardText')}</span><h2>A clear next step.</h2><p>Draft, confirm, fulfill. Keep each order’s state and next action together.</p></article><article><span class="benefit-icon">${icon('UsersThree')}</span><h2>One team workspace.</h2><p>Customers, suppliers and stock records connected to the work they support.</p></article></section><section class="landing-workflow" id="workflow" aria-labelledby="workflow-heading"><div class="workflow-intro"><p class="landing-audience">How the work flows</p><h2 id="workflow-heading">From the first receipt<br>to the final handoff.</h2><p>Keep inventory and customer orders connected, without switching between separate tools.</p><a class="text-link" href="${workspaceUrl}">Try it with sample data ${icon('ArrowRight')}</a></div><div class="workflow-steps"><details open><summary><span class="step-number">01</span><span>Receive what arrived.</span>${icon('Plus')}</summary><div><p>Record a supplier receipt. On-hand stock increases while existing reservations stay allocated.</p><a href="${appUrl}&screen=inventory">Explore inventory ${icon('ArrowUpRight')}</a></div></details><details><summary><span class="step-number">02</span><span>Reserve with the full picture.</span>${icon('Plus')}</summary><div><p>Review the customer’s draft and item quantities. Confirm the order to reserve the available stock.</p><a href="${appUrl}&screen=orders">Review an order ${icon('ArrowUpRight')}</a></div></details><details><summary><span class="step-number">03</span><span>Complete the handoff.</span>${icon('Plus')}</summary><div><p>Fulfill the confirmed order. On-hand and reserved quantities decrease together so availability remains clear.</p><a href="${appUrl}&screen=orders">Open the order register ${icon('ArrowUpRight')}</a></div></details></div></section><section class="landing-closing"><div><h2>A clearer view of every order.</h2><p>Explore the workspace with realistic sample data.</p></div><a class="btn primary" href="${workspaceUrl}">Open the demo ${icon('ArrowRight')}</a></section></main><footer class="landing-footer">${brand}<p>Inventory and B2B orders, in one workspace.</p><span>Design exploration · Illustrative data</span><a href="index.html?concept=${concept}&surface=landing">Compare styles</a></footer></div>`;
  window.mountLogisticsMap(root.querySelector('.landing-hero'));
  root.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tour]');
    if (!tab) return;
    const key = tab.dataset.tour;
    root
      .querySelectorAll('[data-tour]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(button === tab)),
      );
    const image = document.getElementById('tour-image');
    image.src = `assets/${concept}-${key}.png?v=workspace-20261023`;
    image.alt = `Actual StockPilot ${screenshots[key][2]} prototype in the ${concept} style.`;
    document.getElementById('tour-caption-title').textContent =
      screenshots[key][0];
    document.getElementById('tour-caption-copy').textContent =
      screenshots[key][1];
    const url = `${appUrl}&screen=${key}`;
    document.getElementById('tour-open').href = url;
    document.getElementById('tour-image-link').href = url;
    document
      .getElementById('tour-image-link')
      .setAttribute(
        'aria-label',
        `Open the interactive ${screenshots[key][2]} prototype`,
      );
  });
};
