import type { Role } from '@stockpilot/contracts';
import Link from 'next/link';

import { DemoLoginCard } from '../../components/auth/demo-login-card';

const queryRoleMap: Record<string, Role> = {
  manager: 'MANAGER',
  owner: 'OWNER',
  staff: 'STAFF',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  const initialRole = queryRoleMap[role?.toLowerCase() ?? ''] ?? 'MANAGER';

  return (
    <main className="login-page">
      <header className="login-header">
        <Link className="brand" href="/" aria-label="Back to StockPilot home">
          <span className="brand-mark" aria-hidden="true">
            SP
          </span>
          <span>StockPilot</span>
        </Link>
        <Link className="text-link" href="/">
          Back to product overview
        </Link>
      </header>

      <section className="login-layout" aria-label="StockPilot demo login">
        <div className="login-context">
          <p className="kicker">Harbor & Pine Wholesale</p>
          <h2>A working operation, ready to explore.</h2>
          <p>
            The sample company includes live inventory, supplier receipts, B2B
            orders, low-stock exceptions, and an immutable activity history.
          </p>
          <ul>
            <li>
              <strong>Trace every unit</strong>
              <span>Ledger-backed stock history</span>
            </li>
            <li>
              <strong>Respect every boundary</strong>
              <span>Tenant and role-aware access</span>
            </li>
            <li>
              <strong>Retry without duplicates</strong>
              <span>Idempotent operations</span>
            </li>
          </ul>
        </div>
        <DemoLoginCard initialRole={initialRole} />
      </section>
    </main>
  );
}
