'use client';

import type { Role } from '@stockpilot/contracts';

import type { SessionResponse } from '../../lib/api-client';
import {
  AuditWorkspace,
  IntegrationsWorkspace,
  InventoryWorkspace,
  ImportsWorkspace,
  MoreWorkspace,
  OrdersWorkspace,
  OverviewWorkspace,
  PartnersWorkspace,
  ProductsWorkspace,
  ReceiptsWorkspace,
  SettingsWorkspace,
} from '../workflows/operations-workspaces';

export type WorkspaceSection =
  | 'audit'
  | 'imports'
  | 'integrations'
  | 'inventory'
  | 'more'
  | 'orders'
  | 'partners'
  | 'products'
  | 'receipts'
  | 'settings'
  | 'overview';

type SessionView = Pick<SessionResponse, 'membership' | 'user'>;

export function WorkspaceContent({
  section,
  session,
}: {
  section: WorkspaceSection;
  session: SessionView;
}) {
  const role: Role = session.membership.role;
  switch (section) {
    case 'overview':
      return <OverviewWorkspace session={session} />;
    case 'orders':
      return <OrdersWorkspace role={role} />;
    case 'inventory':
      return <InventoryWorkspace role={role} />;
    case 'products':
      return <ProductsWorkspace role={role} />;
    case 'partners':
      return <PartnersWorkspace role={role} />;
    case 'receipts':
      return <ReceiptsWorkspace />;
    case 'imports':
      return <ImportsWorkspace role={role} />;
    case 'integrations':
      return <IntegrationsWorkspace role={role} />;
    case 'audit':
      return <AuditWorkspace />;
    case 'settings':
      return <SettingsWorkspace role={role} />;
    case 'more':
      return <MoreWorkspace />;
  }
}
