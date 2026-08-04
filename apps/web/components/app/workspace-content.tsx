'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

type Section =
  | 'audit'
  | 'imports'
  | 'integrations'
  | 'inventory'
  | 'more'
  | 'orders'
  | 'partners'
  | 'products'
  | 'receipts'
  | 'settings';

type JsonRecord = Record<string, unknown>;

interface ResourceState {
  body: JsonRecord | null;
  error: string | null;
  loading: boolean;
}

const sectionMeta: Record<
  Exclude<Section, 'more'>,
  { description: string; endpoint?: string; title: string }
> = {
  audit: {
    description:
      'Trace the actor, action, and entity behind every operational change.',
    endpoint: '/api/v1/audit-events',
    title: 'Audit trail',
  },
  imports: {
    description:
      'Upload a product CSV, validate row by row, then commit only clean records.',
    title: 'Product imports',
  },
  integrations: {
    description:
      'Review storefront deliveries, failed payloads, and safe manual retries.',
    endpoint: '/api/v1/integration-deliveries',
    title: 'Integrations',
  },
  inventory: {
    description:
      'Separate on-hand, reserved, and available stock before promising an order.',
    endpoint: '/api/v1/inventory/balances',
    title: 'Inventory',
  },
  orders: {
    description:
      'Draft, approve, and fulfill wholesale orders with reservation protection.',
    endpoint: '/api/v1/orders',
    title: 'Sales orders',
  },
  partners: {
    description:
      'Keep customer and supplier records active, searchable, and tenant-scoped.',
    title: 'Partners',
  },
  products: {
    description:
      'Maintain SKU, pricing, and reorder points without deleting referenced history.',
    endpoint: '/api/v1/products',
    title: 'Products',
  },
  receipts: {
    description:
      'Apply a goods receipt atomically and see the resulting ledger movement.',
    endpoint: '/api/v1/inventory/movements',
    title: 'Goods receipts',
  },
  settings: {
    description:
      'Owner controls for the demo organization and team visibility.',
    title: 'Organization settings',
  },
};

export function WorkspaceContent({ section }: { section: Section }) {
  if (section === 'more') return <MorePanel />;
  return <ResourcePanel section={section} />;
}

function ResourcePanel({ section }: { section: Exclude<Section, 'more'> }) {
  if (section === 'partners') return <PartnersPanel />;
  const meta = sectionMeta[section];
  const state = useResource(meta.endpoint);
  const items = useMemo(() => records(state.body?.items), [state.body]);

  return (
    <section className="workspace-section-page" aria-labelledby="section-title">
      <header className="section-page-heading">
        <div>
          <p className="kicker">Operations workspace</p>
          <h1 id="section-title">{meta.title}</h1>
          <p>{meta.description}</p>
        </div>
        <SectionAction section={section} />
      </header>

      {section === 'imports' || section === 'settings' ? (
        <GuidanceCard section={section} />
      ) : state.loading ? (
        <LoadingPanel />
      ) : state.error ? (
        <div className="inline-error" role="alert">
          {state.error}
        </div>
      ) : (
        <>
          <ResourceTable items={items} section={section} />
          {section === 'orders' ? <OrderComposer /> : null}
          {section === 'receipts' ? <ReceiptComposer /> : null}
        </>
      )}
    </section>
  );
}

function PartnersPanel() {
  const customers = useResource('/api/v1/customers');
  const suppliers = useResource('/api/v1/suppliers');
  const loading = customers.loading || suppliers.loading;
  const error = customers.error ?? suppliers.error;
  const items = [
    ...records(customers.body?.items).map((item) => ({
      ...item,
      partnerType: 'Customer',
    })),
    ...records(suppliers.body?.items).map((item) => ({
      ...item,
      partnerType: 'Supplier',
    })),
  ];
  return (
    <section className="workspace-section-page" aria-labelledby="section-title">
      <header className="section-page-heading">
        <div>
          <p className="kicker">Operations workspace</p>
          <h1 id="section-title">Partners</h1>
          <p>
            Keep customer and supplier records active, searchable, and
            tenant-scoped.
          </p>
        </div>
      </header>
      {loading ? (
        <LoadingPanel />
      ) : error ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : (
        <ResourceTable items={items} section="partners" />
      )}
    </section>
  );
}

function OrderComposer() {
  const customers = useResource('/api/v1/customers');
  const products = useResource('/api/v1/products');
  const [customerId, setCustomerId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [message, setMessage] = useState('');
  const customerRows = records(customers.body?.items);
  const productRows = records(products.body?.items);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage('');
    try {
      const csrf = await readCsrf();
      const response = await fetch('/api/v1/orders', {
        body: JSON.stringify({
          customerId,
          lines: [{ productId, quantity: Number(quantity) }],
        }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        method: 'POST',
      });
      if (!response.ok) throw new Error('Could not create the draft order.');
      setMessage('Draft order created.');
      window.location.reload();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not create the draft order.',
      );
    }
  }

  return (
    <form className="quick-form" onSubmit={(event) => void submit(event)}>
      <div>
        <p className="kicker">Quick capture</p>
        <h2>Start a draft order</h2>
      </div>
      <label>
        Customer
        <select
          onChange={(event) => setCustomerId(event.target.value)}
          required
          value={customerId}
        >
          <option value="">Choose customer</option>
          {customerRows.map((customer) => (
            <option
              key={stringValue(customer.id)}
              value={stringValue(customer.id)}
            >
              {stringValue(customer.companyName)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Product
        <select
          onChange={(event) => setProductId(event.target.value)}
          required
          value={productId}
        >
          <option value="">Choose product</option>
          {productRows.map((product) => (
            <option
              key={stringValue(product.id)}
              value={stringValue(product.id)}
            >
              {stringValue(product.sku)} · {stringValue(product.name)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Quantity
        <input
          min="1"
          onChange={(event) => setQuantity(event.target.value)}
          required
          type="number"
          value={quantity}
        />
      </label>
      <button className="secondary-button" type="submit">
        Save draft
      </button>
      {message ? (
        <small className="form-status" role="status">
          {message}
        </small>
      ) : null}
    </form>
  );
}

function ReceiptComposer() {
  const products = useResource('/api/v1/products');
  const suppliers = useResource('/api/v1/suppliers');
  const [productId, setProductId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [message, setMessage] = useState('');
  const productRows = records(products.body?.items);
  const supplierRows = records(suppliers.body?.items);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage('');
    try {
      const csrf = await readCsrf();
      const response = await fetch('/api/v1/receipts', {
        body: JSON.stringify({
          lines: [{ productId, quantity: Number(quantity) }],
          receiptNumber: `WEB-${Date.now()}`,
          receivedAt: new Date().toISOString(),
          supplierId,
        }),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `web-receipt-${crypto.randomUUID()}`,
          'X-CSRF-Token': csrf,
        },
        method: 'POST',
      });
      if (!response.ok) throw new Error('Could not apply the goods receipt.');
      setMessage('Receipt applied to the ledger.');
      window.location.reload();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not apply the goods receipt.',
      );
    }
  }

  return (
    <form className="quick-form" onSubmit={(event) => void submit(event)}>
      <div>
        <p className="kicker">Quick capture</p>
        <h2>Receive stock</h2>
      </div>
      <label>
        Supplier
        <select
          onChange={(event) => setSupplierId(event.target.value)}
          required
          value={supplierId}
        >
          <option value="">Choose supplier</option>
          {supplierRows.map((supplier) => (
            <option
              key={stringValue(supplier.id)}
              value={stringValue(supplier.id)}
            >
              {stringValue(supplier.companyName)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Product
        <select
          onChange={(event) => setProductId(event.target.value)}
          required
          value={productId}
        >
          <option value="">Choose product</option>
          {productRows.map((product) => (
            <option
              key={stringValue(product.id)}
              value={stringValue(product.id)}
            >
              {stringValue(product.sku)} · {stringValue(product.name)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Quantity
        <input
          min="1"
          onChange={(event) => setQuantity(event.target.value)}
          required
          type="number"
          value={quantity}
        />
      </label>
      <button className="secondary-button" type="submit">
        Apply receipt
      </button>
      {message ? (
        <small className="form-status" role="status">
          {message}
        </small>
      ) : null}
    </form>
  );
}

async function readCsrf(): Promise<string> {
  const response = await fetch('/api/v1/auth/csrf', { credentials: 'include' });
  const body = (await response.json()) as JsonRecord;
  if (!response.ok)
    throw new Error('Session expired. Start a fresh demo session.');
  return stringValue(body.csrfToken) ?? '';
}

function SectionAction({ section }: { section: Exclude<Section, 'more'> }) {
  if (section === 'orders') {
    return (
      <Link className="secondary-button" href="/app/orders?new=1">
        New draft order
      </Link>
    );
  }
  if (section === 'receipts') {
    return (
      <Link className="secondary-button" href="/app/receipts?new=1">
        Receive stock
      </Link>
    );
  }
  if (section === 'products') {
    return (
      <Link className="secondary-button" href="/app/products?new=1">
        Add product
      </Link>
    );
  }
  return null;
}

function ResourceTable({
  items,
  section,
}: {
  items: JsonRecord[];
  section: Exclude<Section, 'more'>;
}) {
  if (items.length === 0) {
    return (
      <div className="empty-panel">
        <strong>No {section} to review</strong>
        <p>New activity will appear here as the operation moves.</p>
      </div>
    );
  }

  return (
    <div className="resource-table-wrap">
      <table className="resource-table">
        <thead>
          <tr>
            {columnsFor(section).map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={stringValue(item.id) ?? `${section}-${index}`}>
              {columnsFor(section).map((column) => (
                <td key={column.key} data-label={column.label}>
                  {formatCell(item[column.key], column.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GuidanceCard({ section }: { section: 'imports' | 'settings' }) {
  if (section === 'imports') {
    return (
      <div className="guidance-grid">
        <article className="guidance-card">
          <span className="step-number">01</span>
          <h2>Upload and preview</h2>
          <p>
            Use the columns SKU, name, sale_price, reorder_point, and
            description. Preview highlights row-level errors before anything
            changes.
          </p>
        </article>
        <article className="guidance-card">
          <span className="step-number">02</span>
          <h2>Commit valid rows</h2>
          <p>
            Clean rows commit atomically with an idempotency key. Download the
            error CSV and correct only what needs attention.
          </p>
        </article>
        <article className="guidance-card">
          <span className="step-number">03</span>
          <h2>Export anytime</h2>
          <p>
            <a className="text-link" href="/api/v1/products/export.csv">
              Download the current product catalog
            </a>{' '}
            for a safe handoff.
          </p>
        </article>
      </div>
    );
  }

  return (
    <div className="settings-layout">
      <article className="guidance-card">
        <p className="kicker">Owner controls</p>
        <h2>Harbor &amp; Pine Wholesale</h2>
        <p>USD · Main Warehouse · one organization, one operational ledger.</p>
        <DemoResetButton />
        <small className="muted-note">
          The demo reset is protected by Owner permissions and an idempotency
          key.
        </small>
      </article>
      <article className="guidance-card">
        <p className="kicker">Team boundary</p>
        <h2>Three roles, one shared view</h2>
        <p>
          Staff can prepare and fulfill work. Managers approve, receive, adjust,
          and retry. Owners review organization controls.
        </p>
      </article>
    </div>
  );
}

function DemoResetButton() {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>(
    'idle',
  );

  async function reset(): Promise<void> {
    setState('working');
    try {
      const csrfResponse = await fetch('/api/v1/auth/csrf', {
        credentials: 'include',
      });
      const csrf = (await csrfResponse.json()) as JsonRecord;
      const response = await fetch('/api/v1/organization/demo-reset', {
        credentials: 'include',
        headers: {
          'Idempotency-Key': `web-demo-reset-${crypto.randomUUID()}`,
          'X-CSRF-Token': stringValue(csrf.csrfToken) ?? '',
        },
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Reset is available to the Owner demo only.');
      }
      setState('done');
      window.setTimeout(() => window.location.assign('/app'), 500);
    } catch {
      setState('error');
    }
  }

  return (
    <>
      <button
        className="secondary-button"
        disabled={state === 'working'}
        onClick={() => void reset()}
        type="button"
      >
        {state === 'working' ? 'Resetting…' : 'Reset demo data'}
      </button>
      {state === 'done' ? (
        <small className="success-note" role="status">
          Demo reset. Reloading workspace…
        </small>
      ) : null}
      {state === 'error' ? (
        <small className="form-error" role="alert">
          Reset is available to the Owner demo only.
        </small>
      ) : null}
    </>
  );
}

function MorePanel() {
  const links: ReadonlyArray<readonly [string, string]> = [
    ['Products', '/app/products'],
    ['Partners', '/app/partners'],
    ['Receipts', '/app/receipts'],
    ['Imports', '/app/imports'],
    ['Integrations', '/app/integrations'],
    ['Audit', '/app/audit'],
    ['Owner settings', '/app/settings'],
  ];
  return (
    <section className="workspace-section-page" aria-labelledby="more-title">
      <header className="section-page-heading">
        <div>
          <p className="kicker">Workspace navigation</p>
          <h1 id="more-title">More operations</h1>
          <p>
            Keep the mobile work queue focused, then reach supporting workflows
            here.
          </p>
        </div>
      </header>
      <div className="more-grid">
        {links.map(([label, href]) => (
          <Link className="more-link" href={href} key={href}>
            <strong>{label}</strong>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function LoadingPanel() {
  return (
    <div className="empty-panel" aria-live="polite">
      <strong>Loading workspace data…</strong>
      <p>Fetching the latest tenant-scoped records.</p>
    </div>
  );
}

function useResource(endpoint: string | undefined): ResourceState {
  const [state, setState] = useState<ResourceState>({
    body: null,
    error: null,
    loading: Boolean(endpoint),
  });
  useEffect(() => {
    if (!endpoint) {
      setState({ body: null, error: null, loading: false });
      return;
    }
    let active = true;
    void fetch(endpoint, { credentials: 'include' })
      .then(async (response) => {
        const body = (await response.json()) as JsonRecord;
        if (!response.ok)
          throw new Error(
            stringValue(body.detail) ?? 'Could not load this workspace view.',
          );
        if (active) setState({ body, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (active)
          setState({
            body: null,
            error:
              error instanceof Error
                ? error.message
                : 'Could not load this workspace view.',
            loading: false,
          });
      });
    return () => {
      active = false;
    };
  }, [endpoint]);
  return state;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonRecord => typeof item === 'object' && item !== null,
      )
    : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : undefined;
}

function formatCell(value: unknown, key: string): string {
  if (value === null || value === undefined) return '—';
  if (key === 'product' && typeof value === 'object' && value !== null) {
    const product = value as JsonRecord;
    return (
      [stringValue(product.sku), stringValue(product.name)]
        .filter(Boolean)
        .join(' · ') || '—'
    );
  }
  if (key.toLowerCase().includes('date') || key.endsWith('At')) {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime()))
      return date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function columnsFor(
  section: Exclude<Section, 'more'>,
): Array<{ key: string; label: string }> {
  if (section === 'orders')
    return [
      { key: 'orderNumber', label: 'Order' },
      { key: 'customerCompanyName', label: 'Customer' },
      { key: 'status', label: 'Status' },
      { key: 'subtotal', label: 'Value' },
    ];
  if (section === 'inventory')
    return [
      { key: 'product', label: 'Product' },
      { key: 'onHand', label: 'On hand' },
      { key: 'reserved', label: 'Reserved' },
      { key: 'available', label: 'Available' },
    ];
  if (section === 'products')
    return [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Product' },
      { key: 'salePrice', label: 'Sale price' },
      { key: 'reorderPoint', label: 'Reorder point' },
      { key: 'isActive', label: 'Active' },
    ];
  if (section === 'integrations')
    return [
      { key: 'externalDeliveryId', label: 'Delivery' },
      { key: 'eventType', label: 'Event' },
      { key: 'status', label: 'Status' },
      { key: 'attempts', label: 'Attempts' },
    ];
  if (section === 'audit')
    return [
      { key: 'action', label: 'Action' },
      { key: 'entityType', label: 'Entity' },
      { key: 'createdAt', label: 'When' },
    ];
  if (section === 'receipts')
    return [
      { key: 'type', label: 'Movement' },
      { key: 'product', label: 'Product' },
      { key: 'quantityDelta', label: 'Quantity' },
      { key: 'createdAt', label: 'When' },
    ];
  if (section === 'partners')
    return [
      { key: 'partnerType', label: 'Type' },
      { key: 'companyName', label: 'Company' },
      { key: 'contactName', label: 'Contact' },
      { key: 'email', label: 'Email' },
      { key: 'isActive', label: 'Active' },
    ];
  return [
    { key: 'id', label: 'Record' },
    { key: 'createdAt', label: 'Created' },
  ];
}
