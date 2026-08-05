import {
  MarketingArrowUpRightIcon,
  MarketingCheckIcon,
} from '../components/ui/marketing-icons';

const proofPoints = [
  {
    title: 'A ledger your team can trust',
    body: 'Receiving, reservations, adjustments, and sales stay traceable from the first unit to the last.',
  },
  {
    title: 'A queue that keeps moving',
    body: 'Put approvals, low-stock exceptions, and failed deliveries where the next action is obvious.',
  },
  {
    title: 'Boundaries that make sense',
    body: 'Manager, Staff, and Owner workflows share one workspace without sharing every permission.',
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
    <main className="marketing-page">
      <nav className="site-nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="StockPilot home">
          <span className="brand-mark" aria-hidden="true">
            SP
          </span>
          <span>StockPilot</span>
        </a>
        <div className="site-nav-links">
          <a href="#product">Product</a>
          <a href="#demo">Demo roles</a>
        </div>
      </nav>

      <section id="top" className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">Stock control, under control.</h1>
          <p className="hero-summary">
            Built for small wholesale teams, StockPilot keeps receiving,
            inventory, and B2B orders in one calm operations workspace—so your
            team can act before stock issues slow customers down.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="/login?role=manager">
              Enter manager demo
              <MarketingArrowUpRightIcon />
            </a>
            <a className="text-link" href="#product">
              See the workspace
            </a>
          </div>
          <ul className="hero-assurance" aria-label="StockPilot principles">
            <li>
              <MarketingCheckIcon />
              Permission-aware
            </li>
            <li>
              <MarketingCheckIcon />
              Ledger-backed
            </li>
            <li>
              <MarketingCheckIcon />
              Duplicate-safe
            </li>
          </ul>
        </div>

        <figure className="hero-shot">
          <picture>
            <source
              media="(max-width: 640px)"
              srcSet="/assets/orders-mobile.png"
            />
            <img
              alt="StockPilot operations workspace with a focused order and inventory queue"
              height="728"
              loading="eager"
              src="/assets/overview-desktop.png"
              width="1100"
            />
          </picture>
          <figcaption>
            A focused overview for the next warehouse decision.
          </figcaption>
        </figure>
      </section>

      <section
        id="product"
        className="proof-section"
        aria-labelledby="proof-title"
      >
        <div className="section-heading">
          <h2 id="proof-title">The operating system for the next action.</h2>
          <p>
            Less hunting through screens. More confidence in what is available,
            what needs approval, and what can ship today.
          </p>
        </div>
        <div className="proof-list">
          {proofPoints.map((point, index) => (
            <article key={point.title} className="proof-item">
              <span className="proof-index">0{index + 1}</span>
              <div>
                <h3>{point.title}</h3>
                <p>{point.body}</p>
              </div>
              <MarketingCheckIcon />
            </article>
          ))}
        </div>
      </section>

      <section id="demo" className="demo-section" aria-labelledby="demo-title">
        <div>
          <h2 id="demo-title">Choose a role. See the boundary.</h2>
          <p>
            The seeded Harbor &amp; Pine workspace is safe to explore. Start in
            one click, then switch roles to see how the same operation changes.
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
              <MarketingArrowUpRightIcon />
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
        <p>Inventory and order operations for small wholesale teams.</p>
      </footer>
    </main>
  );
}
