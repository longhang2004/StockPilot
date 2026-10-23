import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Cube,
  Stack,
  ClipboardText,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr';
import { LogisticsMap } from '../components/marketing/logistics-map';
import { ProductTour } from '../components/marketing/product-tour';
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
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
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
    <div className="landing-page">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="marketing-header">
        <nav className="site-nav" aria-label="Primary navigation">
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              <Stack size={20} />
            </span>
            StockPilot
          </Link>
          <div className="site-nav-links">
            <a href="#product-tour">Product</a>
            <a href="#workflow">How it works</a>
          </div>
          <Link className="button button-primary" href="/login?role=manager">
            Explore demo <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </nav>
      </header>
      <main id="main-content">
        <section className="landing-hero" aria-labelledby="hero-title">
          <LogisticsMap />
          <div className="hero-content">
            <p className="landing-audience">
              Inventory &amp; orders for small wholesale teams
            </p>
            <h1 id="hero-title">
              Know your stock.
              <br />
              <span>Keep orders moving.</span>
            </h1>
            <p className="landing-intro">
              A clear workspace for receiving stock, reviewing B2B orders
              <br className="desktop-break" /> and keeping every handoff in
              view.
            </p>
            <div className="hero-actions">
              <Link
                className="button button-primary"
                href="/login?role=manager"
              >
                Explore the workspace{' '}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="button button-secondary" href="/signup">
                Create a workspace
              </Link>
            </div>
            <p className="hero-note">
              Live demo · Seeded data · No account needed
            </p>
          </div>
        </section>
        <ProductTour />
        <section className="landing-benefits" aria-label="What stays connected">
          {[
            {
              Icon: Cube,
              title: 'Stock you can explain.',
              copy: 'On hand, reserved and available. See the orders behind every commitment.',
            },
            {
              Icon: ClipboardText,
              title: 'A clear next step.',
              copy: 'Draft, confirm, fulfill. Keep each order’s state and next action together.',
            },
            {
              Icon: UsersThree,
              title: 'One team workspace.',
              copy: 'Customers, suppliers and stock records connected to the work they support.',
            },
          ].map(({ Icon, title, copy }) => (
            <article key={title}>
              <Icon size={25} aria-hidden="true" />
              <h2>{title}</h2>
              <p>{copy}</p>
            </article>
          ))}
        </section>
        <section
          id="workflow"
          className="landing-workflow"
          aria-labelledby="workflow-title"
        >
          <div className="workflow-intro">
            <p className="landing-audience">How the work flows</p>
            <h2 id="workflow-title">
              From the first receipt
              <br />
              to the final handoff.
            </h2>
            <p>
              Keep inventory and customer orders connected, without switching
              between separate tools.
            </p>
            <a className="text-link" href="/login?role=manager">
              Try it with sample data{' '}
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
          <div className="workflow-steps">
            <details open>
              <summary>
                <span>01</span>Receive what arrived.
              </summary>
              <p>
                Record a supplier receipt. On-hand stock increases while
                existing reservations stay allocated.
              </p>
            </details>
            <details>
              <summary>
                <span>02</span>Reserve with the full picture.
              </summary>
              <p>
                Review the customer’s draft and item quantities. Confirm the
                order to reserve available stock.
              </p>
            </details>
            <details>
              <summary>
                <span>03</span>Complete the handoff.
              </summary>
              <p>
                Fulfill the confirmed order. On-hand and reserved quantities
                decrease together, keeping availability clear.
              </p>
            </details>
          </div>
        </section>
        <section className="landing-demo" aria-labelledby="demo-title">
          <div>
            <p className="landing-audience">Find your perspective</p>
            <h2 id="demo-title">One workspace. Your role.</h2>
            <p>
              Explore the real application with seeded data. Demo data resets
              every six hours.
            </p>
          </div>
          <ul>
            {demoRoles.map((item) => (
              <li key={item.role}>
                <strong>{item.label}</strong>
                <p>{item.description}</p>
                <Link className="text-link" href={`/login?role=${item.role}`}>
                  Enter {item.label} demo{' '}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="landing-closing">
          <div>
            <h2>A clearer view of every order.</h2>
            <p>Start with your team’s inventory and customer orders.</p>
          </div>
          <Link className="button button-primary" href="/signup">
            Create a workspace <ArrowRight size={17} aria-hidden="true" />
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
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            <Stack size={20} />
          </span>
          StockPilot
        </Link>
        <p>Inventory and B2B orders, in one workspace.</p>
        <nav aria-label="Reference links">
          <a
            href="https://github.com/longhang2004/StockPilot"
            target="_blank"
            rel="noreferrer"
          >
            View source
          </a>
          <Link href="/login">Sign in</Link>
        </nav>
      </footer>
    </div>
  );
}
