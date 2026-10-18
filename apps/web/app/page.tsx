import type { Metadata } from 'next';
import Link from 'next/link';

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

const demoRoles = [
  {
    role: 'manager',
    label: 'Manager',
    description: 'Receive stock, confirm orders, and resolve exceptions.',
  },
  {
    role: 'staff',
    label: 'Staff',
    description: 'Prepare orders and fulfill work that is ready to ship.',
  },
  {
    role: 'owner',
    label: 'Owner',
    description: 'Review team access, workspace controls, and audit history.',
  },
] as const;

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
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              SP
            </span>
            <span>StockPilot</span>
          </Link>
          <div className="site-nav-links">
            <a href="#inventory-worklist">Inventory worklist</a>
            <a href="#workflow">Process</a>
          </div>
          <Link
            className="button button-primary site-nav-cta"
            href="/login?role=manager"
          >
            Open the demo
          </Link>
        </nav>
      </header>

      <main id="main-content" className="marketing-page">
        <section className="public-hero" aria-labelledby="hero-title">
          <div className="public-hero-copy">
            <h1 id="hero-title">Inventory and B2B order operations</h1>
            <p className="hero-summary">
              Review stock, prepare customer orders, receive supplier goods and
              trace changes in one workspace.
            </p>
            <div className="hero-actions">
              <Link
                className="button button-primary"
                href="/login?role=manager"
              >
                Start with the Manager demo
              </Link>
              <Link className="button button-secondary" href="/signup">
                Create a workspace
              </Link>
            </div>
            <p className="hero-note">
              The demo uses seeded data and needs no signup.
            </p>
          </div>

          <section className="demo-entry" aria-labelledby="demo-entry-title">
            <div className="demo-entry-heading">
              <div>
                <h2 id="demo-entry-title">Open a role-based demo</h2>
              </div>
            </div>
            <ul className="demo-role-list">
              {demoRoles.map((item) => (
                <li key={item.role}>
                  <span className="demo-role-copy">
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  <Link
                    className="role-entry-link"
                    href={`/login?role=${item.role}`}
                  >
                    Enter {item.label} demo
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </section>

        <section
          id="inventory-worklist"
          className="product-evidence"
          aria-labelledby="worklist-title"
        >
          <div className="product-evidence-heading">
            <div>
              <h2 id="worklist-title">Inventory worklist</h2>
              <p>
                Available quantity and reorder point shown together for review.
              </p>
            </div>
            <span>Illustrative data</span>
          </div>
          <div
            tabIndex={0}
            role="region"
            aria-label="Illustrative inventory example table"
            className="product-evidence-table-wrap"
          >
            <table className="product-evidence-table">
              <caption className="sr-only">
                Illustrative inventory worklist rows
              </caption>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">SKU</th>
                  <th scope="col">On hand</th>
                  <th scope="col">Reserved</th>
                  <th scope="col">Available</th>
                  <th scope="col">Reorder point</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Arabica coffee, 1 kg</th>
                  <td>COF-1042</td>
                  <td>184</td>
                  <td>32</td>
                  <td>152</td>
                  <td>80</td>
                </tr>
                <tr>
                  <th scope="row">Cold brew bottles, 12 × 250 ml</th>
                  <td>DRK-2280</td>
                  <td>46</td>
                  <td>38</td>
                  <td>8</td>
                  <td>24</td>
                </tr>
                <tr>
                  <th scope="row">Paper cups, 500 count</th>
                  <td>PKG-3016</td>
                  <td>0</td>
                  <td>0</td>
                  <td>0</td>
                  <td>40</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section
          id="workflow"
          className="workflow-section"
          aria-labelledby="workflow-title"
        >
          <div className="section-intro">
            <h2 id="workflow-title">From receipt to fulfillment</h2>
            <p>
              Receipts add stock, order confirmation reserves it, and
              fulfillment records the shipment and resulting stock movement.
            </p>
          </div>
          <ol className="workflow-list">
            <li>
              <strong>Receive</strong>
              <span>Post supplier quantities</span>
            </li>
            <li>
              <strong>Confirm</strong>
              <span>Reserve available stock</span>
            </li>
            <li>
              <strong>Fulfill</strong>
              <span>Record dispatched goods</span>
            </li>
            <li>
              <strong>Review</strong>
              <span>Inspect movement and audit history</span>
            </li>
          </ol>
        </section>

        <section className="public-proof" aria-label="Reliability details">
          <h2>Operational controls</h2>
          <ul>
            <li>Tenant and role-aware access</li>
            <li>Append-only stock history</li>
            <li>Duplicate-safe commands</li>
            <li>Oversell protection</li>
          </ul>
          <a
            className="text-link"
            href="https://github.com/longhang2004/StockPilot"
            target="_blank"
            rel="noreferrer"
          >
            View the source and technical documentation
          </a>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
          }}
        />
      </main>

      <footer className="marketing-footer">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            SP
          </span>
          <span>StockPilot</span>
        </Link>
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
        </nav>
      </footer>
    </>
  );
}
