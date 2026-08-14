import { createHash } from 'node:crypto';

/**
 * Stable demo fixture declarations and helpers.
 *
 * Everything in this module is deterministic and intentionally immutable:
 * fixture keys, counts, relationships, quantities, and the deterministic-ID
 * algorithm are load-bearing for seed idempotency, the automatic demo reset,
 * and the integration/e2e suites that assert exact counts. Keep changes here
 * in lockstep with `DEMO_FIXTURE_COUNTS` and the integration specs.
 */

export const DEMO_FIXTURE_COUNTS = {
  activeProducts: 8,
  cancelledOrders: 1,
  confirmedOrders: 1,
  customers: 5,
  draftOrders: 2,
  failedDeliveries: 1,
  fulfilledOrders: 2,
  inactiveProducts: 1,
  invalidImportRows: 1,
  lowStockAlerts: 2,
  suppliers: 3,
} as const;

export const RESET_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface ProductFixture {
  description: string;
  key: string;
  name: string;
  reorderPoint: number;
  salePrice: string;
  sku: string;
}

export const productFixtures: readonly ProductFixture[] = [
  {
    description: 'Reliable carton sealing tape for daily dispatches.',
    key: 'product-1',
    name: 'Packing Tape 48mm',
    reorderPoint: 8,
    salePrice: '12.50',
    sku: 'HP-1001',
  },
  {
    description: 'Double-wall cartons sized for wholesale case packing.',
    key: 'product-2',
    name: 'Kraft Carton Large',
    reorderPoint: 12,
    salePrice: '18.00',
    sku: 'HP-1002',
  },
  {
    description: 'Thermal labels for parcel and pallet shipments.',
    key: 'product-3',
    name: 'Thermal Labels 4x6',
    reorderPoint: 10,
    salePrice: '24.00',
    sku: 'HP-1003',
  },
  {
    description: 'Powder-free nitrile gloves for warehouse handling.',
    key: 'product-4',
    name: 'Nitrile Gloves L',
    reorderPoint: 6,
    salePrice: '32.50',
    sku: 'HP-1004',
  },
  {
    description: 'Clear stretch wrap for pallet stability.',
    key: 'product-5',
    name: 'Stretch Wrap 500mm',
    reorderPoint: 5,
    salePrice: '15.75',
    sku: 'HP-1005',
  },
  {
    description: 'Permanent marker set for bin and carton labelling.',
    key: 'product-6',
    name: 'Warehouse Marker Set',
    reorderPoint: 4,
    salePrice: '9.90',
    sku: 'HP-1006',
  },
  {
    description: 'Protective guards for pallet corners in transit.',
    key: 'product-7',
    name: 'Pallet Corner Guards',
    reorderPoint: 5,
    salePrice: '21.00',
    sku: 'HP-1007',
  },
  {
    description: 'Bright inventory tags for fast cycle counts.',
    key: 'product-8',
    name: 'Inventory Tags',
    reorderPoint: 3,
    salePrice: '7.25',
    sku: 'HP-1008',
  },
  {
    description: 'Retired mailer kept for historical order snapshots.',
    key: 'product-9-inactive',
    name: 'Legacy Poly Mailer',
    reorderPoint: 0,
    salePrice: '5.00',
    sku: 'HP-1009',
  },
] as const;

export interface CustomerFixture {
  companyName: string;
  contactName: string;
  key: string;
}

export const customerFixtures: readonly CustomerFixture[] = [
  {
    companyName: 'Northstar Office Supply',
    contactName: 'Avery Chen',
    key: 'customer-1',
  },
  {
    companyName: 'Cedar Street Market',
    contactName: 'Mina Patel',
    key: 'customer-2',
  },
  {
    companyName: 'Bluebird Hospitality',
    contactName: 'Jordan Lee',
    key: 'customer-3',
  },
  {
    companyName: 'Atlas Facilities Group',
    contactName: 'Riley Nguyen',
    key: 'customer-4',
  },
  {
    companyName: 'Goodship Retail Co.',
    contactName: 'Taylor Morgan',
    key: 'customer-5',
  },
] as const;

export interface SupplierFixture {
  companyName: string;
  contactName: string;
  key: string;
}

export const supplierFixtures: readonly SupplierFixture[] = [
  {
    companyName: 'Evergreen Packaging',
    contactName: 'Casey Wright',
    key: 'supplier-1',
  },
  {
    companyName: 'Harbor Safety Goods',
    contactName: 'Emery Brooks',
    key: 'supplier-2',
  },
  {
    companyName: 'Signal Label Works',
    contactName: 'Quinn Adams',
    key: 'supplier-3',
  },
] as const;

/** Receipt line quantities per product key (8 lines on the single receipt). */
export const receiptQuantities: Readonly<Record<string, number>> = {
  'product-1': 25,
  'product-2': 12,
  'product-3': 8,
  'product-4': 50,
  'product-5': 20,
  'product-6': 15,
  'product-7': 10,
  'product-8': 25,
};

/** Inventory projection rows per product key (8 balances, 1 reserved). */
export const balanceQuantities: Readonly<
  Record<string, { onHand: number; reserved: number; version: number }>
> = {
  'product-1': { onHand: 20, reserved: 4, version: 3 },
  'product-2': { onHand: 12, reserved: 0, version: 1 },
  'product-3': { onHand: 8, reserved: 0, version: 1 },
  'product-4': { onHand: 40, reserved: 0, version: 2 },
  'product-5': { onHand: 20, reserved: 0, version: 1 },
  'product-6': { onHand: 15, reserved: 0, version: 1 },
  'product-7': { onHand: 10, reserved: 0, version: 1 },
  'product-8': { onHand: 25, reserved: 0, version: 1 },
};

export interface OrderFixture {
  /** Demo role key resolved to a real user id by the seeding orchestration. */
  createdByRole: 'manager' | 'staff';
  customerKey: string;
  key: string;
  line: { productKey: string; quantity: number };
  orderNumber: string;
  status: 'CANCELLED' | 'CONFIRMED' | 'DRAFT' | 'FULFILLED';
  timeOffsetMinutes: number;
}

/** The six sales orders spanning every state-machine status. */
export const orderFixtures: readonly OrderFixture[] = [
  {
    createdByRole: 'staff',
    customerKey: 'customer-1',
    key: 'order-draft-1',
    line: { productKey: 'product-1', quantity: 2 },
    orderNumber: 'SO-2026-1001',
    status: 'DRAFT',
    timeOffsetMinutes: 2 * 24 * 60,
  },
  {
    createdByRole: 'staff',
    customerKey: 'customer-2',
    key: 'order-draft-2',
    line: { productKey: 'product-5', quantity: 3 },
    orderNumber: 'SO-2026-1002',
    status: 'DRAFT',
    timeOffsetMinutes: 36 * 60,
  },
  {
    createdByRole: 'manager',
    customerKey: 'customer-3',
    key: 'order-confirmed-1',
    line: { productKey: 'product-1', quantity: 4 },
    orderNumber: 'SO-2026-1003',
    status: 'CONFIRMED',
    timeOffsetMinutes: 24 * 60,
  },
  {
    createdByRole: 'manager',
    customerKey: 'customer-4',
    key: 'order-fulfilled-1',
    line: { productKey: 'product-1', quantity: 5 },
    orderNumber: 'SO-2026-1004',
    status: 'FULFILLED',
    timeOffsetMinutes: 18 * 60,
  },
  {
    createdByRole: 'manager',
    customerKey: 'customer-5',
    key: 'order-fulfilled-2',
    line: { productKey: 'product-4', quantity: 10 },
    orderNumber: 'SO-2026-1005',
    status: 'FULFILLED',
    timeOffsetMinutes: 12 * 60,
  },
  {
    createdByRole: 'staff',
    customerKey: 'customer-2',
    key: 'order-cancelled-1',
    line: { productKey: 'product-6', quantity: 2 },
    orderNumber: 'SO-2026-1006',
    status: 'CANCELLED',
    timeOffsetMinutes: 6 * 60,
  },
];

/** SALE movements written for fulfilled orders (reference by fixture key). */
export const fulfilledSaleMovements: ReadonlyArray<{
  orderKey: string;
  productKey: string;
  quantity: number;
  onHandAfter: number;
}> = [
  {
    orderKey: 'order-fulfilled-1',
    productKey: 'product-1',
    quantity: 5,
    onHandAfter: 20,
  },
  {
    orderKey: 'order-fulfilled-2',
    productKey: 'product-4',
    quantity: 10,
    onHandAfter: 40,
  },
];

/**
 * Deterministic UUID v5-style id for a fixture key: SHA-1 of
 * `stockpilot-demo-fixture:v1:{organizationId}:{key}` with version/variant
 * bits set. Fixture ids are load-bearing (tests and e2e assertions reference
 * the demo rows); the algorithm must not change.
 */
export function fixtureId(organizationId: string, key: string): string {
  const digest = createHash('sha1')
    .update(`stockpilot-demo-fixture:v1:${organizationId}:${key}`)
    .digest();
  digest[6] = (digest[6]! & 0x0f) | 0x50;
  digest[8] = (digest[8]! & 0x3f) | 0x80;
  const hex = digest.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function relativeDate(now: Date, minutesAgo: number): Date {
  return new Date(now.getTime() - minutesAgo * 60 * 1000);
}

export function money(value: string, quantity: number): string {
  return (Number(value) * quantity).toFixed(2);
}
