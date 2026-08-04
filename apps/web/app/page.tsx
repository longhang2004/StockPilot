const proofPoints = [
  {
    eyebrow: 'Inventory integrity',
    title: 'Know what is actually available',
    body: 'Separate on-hand, reserved, and available stock so the team can promise orders with confidence.',
  },
  {
    eyebrow: 'Order control',
    title: 'Move work forward without overselling',
    body: 'Use clear approvals and atomic reservations from draft through fulfillment.',
  },
  {
    eyebrow: 'Operational clarity',
    title: 'See exceptions before they become delays',
    body: 'Low-stock alerts, failed integrations, and orders awaiting action share one focused queue.',
  },
] as const;

const demoRoles = [
  {
    role: 'manager',
    label: 'Enter manager demo',
    detail: 'Run the daily operation',
    primary: true,
  },
  {
    role: 'staff',
    label: 'Enter staff demo',
    detail: 'Prepare and fulfill orders',
    primary: false,
  },
  {
    role: 'owner',
    label: 'Enter owner demo',
    detail: 'Review controls and settings',
    primary: false,
  },
] as const;

export default function HomePage() {
  return (
    <main>
      <nav className="site-nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="StockPilot home">
          <span className="brand-mark" aria-hidden="true">
            SP
          </span>
          <span>StockPilot</span>
        </a>
        <div className="nav-note">
          <span className="status-dot" aria-hidden="true" />
          Interactive portfolio demo
        </div>
      </nav>

      <section id="top" className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="kicker">Built for small wholesale teams</p>
          <h1 id="hero-title">Stock control without the guesswork.</h1>
          <p className="hero-summary">
            StockPilot keeps receiving, inventory, and B2B orders in one calm
            operations workspace—so your team can act before stock issues slow
            customers down.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="/login?role=manager">
              Enter manager demo
              <span aria-hidden="true">→</span>
            </a>
            <a className="text-link" href="#how-it-works">
              See how it works
            </a>
          </div>
          <dl className="hero-metrics" aria-label="Demo proof points">
            <div>
              <dt>3 roles</dt>
              <dd>Permission-aware workflows</dd>
            </div>
            <div>
              <dt>1 ledger</dt>
              <dd>Traceable stock history</dd>
            </div>
            <div>
              <dt>0 duplicates</dt>
              <dd>Idempotent integration events</dd>
            </div>
          </dl>
        </div>

        <div
          className="operations-preview"
          aria-label="Operations overview preview"
        >
          <div className="preview-header">
            <div>
              <p>Tuesday, 10:24 AM</p>
              <h2>Operations overview</h2>
            </div>
            <span className="live-pill">Live demo data</span>
          </div>
          <div className="preview-grid">
            <article className="preview-stat alert-stat">
              <span>Needs attention</span>
              <strong>7</strong>
              <small>3 orders · 4 stock alerts</small>
            </article>
            <article className="preview-stat">
              <span>Open order value</span>
              <strong>$18,420</strong>
              <small>12 active wholesale orders</small>
            </article>
          </div>
          <div className="attention-list">
            <div className="section-label">
              <span>Priority queue</span>
              <span>Updated now</span>
            </div>
            <div className="attention-row">
              <span className="severity severity-high">Low stock</span>
              <div>
                <strong>Organic Oat Milk · 12 pack</strong>
                <small>4 available · reorder point 16</small>
              </div>
              <span aria-hidden="true">›</span>
            </div>
            <div className="attention-row">
              <span className="severity severity-medium">Approval</span>
              <div>
                <strong>SO-1048 · Northstar Market</strong>
                <small>$2,860 · 8 line items</small>
              </div>
              <span aria-hidden="true">›</span>
            </div>
            <div className="attention-row">
              <span className="severity severity-neutral">Import</span>
              <div>
                <strong>Storefront order needs review</strong>
                <small>Unknown SKU at line 3</small>
              </div>
              <span aria-hidden="true">›</span>
            </div>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="proof-section"
        aria-labelledby="proof-title"
      >
        <div className="section-heading">
          <p className="kicker">One source of operational truth</p>
          <h2 id="proof-title">
            Built around the decisions your team makes every day.
          </h2>
        </div>
        <div className="proof-grid">
          {proofPoints.map((point, index) => (
            <article key={point.title} className="proof-card">
              <span className="proof-index">0{index + 1}</span>
              <p>{point.eyebrow}</p>
              <h3>{point.title}</h3>
              <span>{point.body}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="demo-section" aria-labelledby="demo-title">
        <div>
          <p className="kicker">Explore the controls</p>
          <h2 id="demo-title">Choose a role. See the boundaries.</h2>
          <p>
            Every account shares the same seeded wholesale workspace. Demo data
            resets automatically, so you can safely receive stock and move
            orders.
          </p>
        </div>
        <div className="role-list">
          {demoRoles.map((demoRole) => (
            <a
              key={demoRole.role}
              className={`role-link${demoRole.primary ? ' role-link-primary' : ''}`}
              href={`/login?role=${demoRole.role}`}
            >
              <span>
                <strong>{demoRole.label}</strong>
                <small>{demoRole.detail}</small>
              </span>
              <span aria-hidden="true">→</span>
            </a>
          ))}
        </div>
      </section>

      <footer>
        <a className="brand" href="#top">
          <span className="brand-mark" aria-hidden="true">
            SP
          </span>
          <span>StockPilot</span>
        </a>
        <p>Designed and engineered as a production-minded SaaS case study.</p>
      </footer>
    </main>
  );
}
