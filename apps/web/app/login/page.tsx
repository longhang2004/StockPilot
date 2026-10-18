import type { Role } from '@stockpilot/contracts';
import Link from 'next/link';

import { DemoLoginCard } from '../../components/auth/demo-login-card';
import { LoginForm } from '../../components/auth/login-form';
import { MarketingArrowLeftIcon } from '../../components/ui/marketing-icons';

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
  const initialRole = queryRoleMap[role?.toLowerCase() ?? ''];
  const isDemo = Boolean(initialRole);

  return (
    <main className="login-page">
      <header className="login-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            SP
          </span>
          <span>StockPilot</span>
        </Link>
        <div className="auth-header-links">
          <Link className="text-link" href="/">
            <MarketingArrowLeftIcon />
            Back to product overview
          </Link>
          <Link
            className="text-link"
            href={isDemo ? '/login' : '/login?role=manager'}
          >
            {isDemo ? 'Sign in to an account' : 'Open demo'}
          </Link>
        </div>
      </header>

      <section
        className="login-layout"
        aria-label={isDemo ? 'StockPilot demo login' : 'Sign in to StockPilot'}
      >
        <div className="login-context">
          <h1>
            {isDemo ? 'Explore the demo workspace' : 'Access your workspace'}
          </h1>
          <p>
            {isDemo
              ? 'Choose a role for the seeded wholesale operation.'
              : 'Sign in with the email and password for your StockPilot account.'}
          </p>
        </div>
        {initialRole ? (
          <DemoLoginCard initialRole={initialRole} />
        ) : (
          <LoginForm />
        )}
      </section>
    </main>
  );
}
