import Link from 'next/link';

import { SignupForm } from '../../components/auth/signup-form';
import { MarketingArrowLeftIcon } from '../../components/ui/marketing-icons';

export default async function SignupPage() {
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
          <MarketingArrowLeftIcon />
          Back to product overview
        </Link>
      </header>

      <section className="login-layout" aria-label="StockPilot signup">
        <div className="login-context">
          <h1>Your workspace starts with an account.</h1>
          <p>
            Sign up, create a workspace, and you are its Owner. Then invite
            teammates as Managers and Staff.
          </p>
          <ul>
            <li>
              <strong>Signup</strong>
              <span>Secure Argon2id password hashing</span>
            </li>
            <li>
              <strong>Workspace</strong>
              <span>Atomic organization + Owner membership</span>
            </li>
            <li>
              <strong>Team</strong>
              <span>Invitation links with hashed, expiring tokens</span>
            </li>
          </ul>
        </div>
        <SignupForm />
      </section>
    </main>
  );
}
