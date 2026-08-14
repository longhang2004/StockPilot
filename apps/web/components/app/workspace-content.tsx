'use client';

import type { Role } from '@stockpilot/contracts';

import type { WorkspaceSessionView } from '../../features/shared/types';
import type { WorkspaceSection } from '../../features/workspace/sections';
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

export type { WorkspaceSection };

export function WorkspaceContent({
  section,
  session,
}: {
  section: WorkspaceSection;
  session: WorkspaceSessionView;
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
      return <MoreWorkspace session={session} />;
  }
}
