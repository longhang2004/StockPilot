import type { Metadata } from 'next';
import Image, { getImageProps } from 'next/image';
import Link from 'next/link';

import {
  MarketingArrowUpRightIcon,
  MarketingCheckIcon,
} from '../components/ui/marketing-icons';
import {
  homepageTitle,
  siteDescription,
  siteName,
  siteOrigin,
} from '../lib/site-config';

export const metadata: Metadata = {
  title: { absolute: homepageTitle },
  description: siteDescription,
  alternates: { canonical: '/' },
  openGraph: {
    title: homepageTitle,
    description: siteDescription,
    url: siteOrigin,
    siteName,
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'StockPilot inventory and B2B order operations workspace overview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: homepageTitle,
    description: siteDescription,
    images: ['/twitter-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
};

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

const productTours = [
  {
    number: '01',
    eyebrow: 'Overview / exception queue',
    title: 'See the exceptions before they become escalations.',
    body: 'A focused queue puts approvals, low stock, failed deliveries, and recent activity beside the measures that explain them. The team starts with the next decision—not a blank dashboard.',
    image: '/assets/overview-desktop.png',
    alt: 'StockPilot overview queue with approvals, low-stock alerts, and recent activity',
    caption: 'One operational queue for the decisions that need attention.',
  },
  {
    number: '02',
    eyebrow: 'Inventory / accuracy',
    title: 'Know what can move before a customer asks.',
    body: 'A balance projection keeps on hand, reserved, and available stock in one readable view. Low-stock exceptions stay close to the decision that resolves them.',
    image: '/assets/inventory-desktop.png',
    alt: 'StockPilot inventory balances with available quantities and low-stock exceptions',
    caption: 'Balances, availability, and the next replenishment decision.',
  },
  {
    number: '03',
    eyebrow: 'Receipt → order / mobile',
    title: 'Carry the receipt-to-order handoff with you.',
    body: 'Receive stock once, update the balance and movement ledger together, then reserve and fulfill without guessing. Mobile surfaces keep the handoff usable on the warehouse floor.',
    image: '/assets/receipt-drawer-mobile.png',
    alt: 'StockPilot mobile receipt drawer for receiving warehouse stock',
    caption: 'A focused mobile receipt flow for the warehouse floor.',
  },
] as const;

const workflowSteps = [
  {
    label: 'Receive',
    body: 'Apply inbound stock and record the movement.',
  },
  {
    label: 'Reserve',
    body: 'Confirm demand while protecting available units.',
  },
  {
    label: 'Fulfill',
    body: 'Ship the confirmed order and post the sale.',
  },
  {
    label: 'Audit',
    body: 'Trace every important mutation back to its actor.',
  },
] as const;

const trustPoints = [
  'Tenant isolation and role-aware permissions',
  'Append-only stock history with database invariants',
  'Idempotent commands and duplicate-safe integrations',
  'Deterministic row locks that reject overselling',
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

function HeroWorkspaceImage() {
  const { props: desktopImage } = getImageProps({
    src: '/assets/overview-desktop.png',
    alt: 'StockPilot demo workspace showing inventory and order operations',
    width: 1100,
    height: 728,
    sizes: '(max-width: 900px) 100vw, 58vw',
    quality: 75,
    loading: 'eager',
    fetchPriority: 'high',
  });
  const {
    props: { srcSet: mobileSrcSet },
  } = getImageProps({
    src: '/assets/orders-mobile.png',
    alt: 'StockPilot demo workspace showing inventory and order operations',
    width: 520,
    height: 752,
    sizes: '100vw',
    quality: 75,
    loading: 'eager',
    fetchPriority: 'high',
  });

  return (
    <picture>
      <source media="(max-width: 640px)" srcSet={mobileSrcSet} />
      <img {...desktopImage} className="hero-image" />
    </picture>
  );
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: siteName,
      url: siteOrigin,
      description: siteDescription,
      inLanguage: 'en',
    },
    {
      '@type': 'WebPage',
      name: homepageTitle,
      url: siteOrigin,
      description: siteDescription,
      inLanguage: 'en',
      primaryImageOfPage: `${siteOrigin}/assets/overview-desktop.png`,
    },
    {
      '@type': 'SoftwareApplication',
      name: siteName,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: siteDescription,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
    {
      '@type': 'Organization',
      name: siteName,
      url: siteOrigin,
      logo: `${siteOrigin}/icon`,
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="marketing-header">
        <nav className="site-nav" aria-label="Primary navigation">
          <a className="brand" href="#top" aria-label="StockPilot home">
            <span className="brand-mark" aria-hidden="true">
              SP
            </span>
            <span>StockPilot</span>
          </a>
          <div className="site-nav-links">
            <a href="#product">Product</a>
            <a href="#workflow">Workflow</a>
            <a href="#trust">Trust</a>
            <a href="#demo">Demo</a>
          </div>
          <div className="site-nav-cta">
            <Link
              className="button button-nav-action"
              href="/login?role=manager"
            >
              Manager demo
              <MarketingArrowUpRightIcon />
            </Link>
          </div>
        </nav>
      </header>

      <main id="main-content" className="marketing-page">
        <section id="top" className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">WHOLESALE OPERATIONS / LIVE DEMO</p>
            <h1 id="hero-title">
              Inventory and B2B order operations, under control.
            </h1>
            <p className="hero-summary">
              StockPilot gives small wholesale teams one calm workspace for
              receiving, inventory, and orders—so the next warehouse decision is
              always visible.
            </p>
            <div className="hero-actions">
              <Link
                className="button button-primary"
                href="/login?role=manager"
              >
                Explore manager demo
                <MarketingArrowUpRightIcon />
              </Link>
              <a className="text-link" href="#workflow">
                See the workflow
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
            <HeroWorkspaceImage />
            <figcaption>
              A real seeded workspace for the next warehouse decision.
            </figcaption>
          </figure>
        </section>

        <section
          id="product"
          className="proof-section"
          aria-labelledby="proof-title"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE OPERATING RHYTHM</p>
              <h2 id="proof-title">Make the next action obvious.</h2>
            </div>
            <p>
              Less hunting through screens. More confidence in what is
              available, what needs approval, and what can ship today.
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

        <section className="tour-section" aria-labelledby="tour-title">
          <div className="section-heading tour-heading">
            <div>
              <p className="eyebrow">PRODUCT TOUR</p>
              <h2 id="tour-title">The details are where trust is built.</h2>
            </div>
            <p>
              Follow the real workflows behind the demo. Each screen is a
              decision surface, not decoration.
            </p>
          </div>
          <div className="tour-list">
            {productTours.map((tour, index) => (
              <article
                key={tour.number}
                className={`tour-row${index % 2 === 1 ? ' tour-row-reverse' : ''}`}
              >
                <div className="tour-copy">
                  <span className="tour-number">{tour.number}</span>
                  <p className="eyebrow">{tour.eyebrow}</p>
                  <h3>{tour.title}</h3>
                  <p>{tour.body}</p>
                </div>
                <figure className="tour-shot">
                  <Image
                    src={tour.image}
                    alt={tour.alt}
                    width={tour.image.includes('mobile') ? 520 : 1100}
                    height={tour.image.includes('mobile') ? 752 : 728}
                    sizes="(max-width: 900px) 100vw, 50vw"
                    loading="lazy"
                  />
                  <figcaption>{tour.caption}</figcaption>
                </figure>
              </article>
            ))}
          </div>
        </section>

        <section
          id="workflow"
          className="workflow-section"
          aria-labelledby="workflow-title"
        >
          <div className="workflow-panel">
            <div className="section-heading section-heading-dark">
              <div>
                <p className="eyebrow">RECEIVE → RESERVE → FULFILL → AUDIT</p>
                <h2 id="workflow-title">A workflow that holds together.</h2>
              </div>
              <p>
                Every handoff leaves a trace. Every state change protects the
                stock position that comes next.
              </p>
            </div>
            <ol className="workflow-list">
              {workflowSteps.map((step, index) => (
                <li key={step.label}>
                  <span className="workflow-index">0{index + 1}</span>
                  <div>
                    <strong>{step.label}</strong>
                    <span>{step.body}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="trust"
          className="trust-section"
          aria-labelledby="trust-title"
        >
          <div className="trust-copy">
            <p className="eyebrow">ENGINEERING PROOF</p>
            <h2 id="trust-title">Boring guarantees are the feature.</h2>
            <p>
              StockPilot is a portfolio demo built around the reliability
              details small teams feel every day: isolation, traceability,
              idempotency, and safe concurrency.
            </p>
            <div className="reference-links">
              <a
                className="text-link"
                href="https://github.com/longhang2004/StockPilot"
                target="_blank"
                rel="noreferrer"
              >
                View source on GitHub
                <MarketingArrowUpRightIcon />
              </a>
              <a
                className="text-link"
                href="https://github.com/longhang2004/StockPilot/blob/main/docs/architecture.md"
                target="_blank"
                rel="noreferrer"
              >
                Read the architecture
                <MarketingArrowUpRightIcon />
              </a>
              <a
                className="text-link"
                href="https://stockpilot-api-y1aw.onrender.com/docs"
                target="_blank"
                rel="noreferrer"
              >
                Open the API docs
                <MarketingArrowUpRightIcon />
              </a>
            </div>
          </div>
          <ul className="trust-list">
            {trustPoints.map((point, index) => (
              <li key={point}>
                <span className="proof-index">0{index + 1}</span>
                <span>{point}</span>
                <MarketingCheckIcon />
              </li>
            ))}
          </ul>
        </section>

        <section
          id="demo"
          className="demo-section"
          aria-labelledby="demo-title"
        >
          <div>
            <p className="eyebrow">SAFE TO EXPLORE</p>
            <h2 id="demo-title">Choose a role. See the boundary.</h2>
            <p>
              The seeded Harbor &amp; Pine workspace resets every six hours.
              Start in one click, then switch roles to see how the same
              operation changes.
            </p>
          </div>
          <div className="role-list">
            {demoRoles.map((demoRole) => (
              <Link
                key={demoRole.role}
                className={`role-link${demoRole.primary ? ' role-link-primary' : ''}`}
                href={`/login?role=${demoRole.role}`}
              >
                <span>
                  <strong>{demoRole.label}</strong>
                  <small>{demoRole.detail}</small>
                </span>
                <MarketingArrowUpRightIcon />
              </Link>
            ))}
          </div>
        </section>

        <section className="final-cta" aria-labelledby="final-cta-title">
          <p className="eyebrow">READY WHEN YOU ARE</p>
          <h2 id="final-cta-title">See the operation in motion.</h2>
          <p>
            Start with the Manager demo, then follow one receipt all the way to
            fulfillment and audit.
          </p>
          <Link className="button button-primary" href="/login?role=manager">
            Explore manager demo
            <MarketingArrowUpRightIcon />
          </Link>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
          }}
        />
      </main>

      <footer className="marketing-footer">
        <div className="footer-brand">
          <a className="brand" href="#top">
            <span className="brand-mark" aria-hidden="true">
              SP
            </span>
            <span>StockPilot</span>
          </a>
          <p>Inventory and order operations for small wholesale teams.</p>
        </div>
        <nav aria-label="Reference links">
          <a
            href="https://github.com/longhang2004/StockPilot"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a
            href="https://github.com/longhang2004/StockPilot/blob/main/docs/walkthrough.md"
            target="_blank"
            rel="noreferrer"
          >
            Walkthrough
          </a>
          <a
            href="https://github.com/longhang2004/StockPilot/blob/main/docs/architecture.md"
            target="_blank"
            rel="noreferrer"
          >
            Architecture
          </a>
          <a
            href="https://stockpilot-api-y1aw.onrender.com/docs"
            target="_blank"
            rel="noreferrer"
          >
            API docs
          </a>
          <a
            href="https://github.com/longhang2004/StockPilot/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
          >
            MIT license
          </a>
        </nav>
      </footer>
    </>
  );
}
