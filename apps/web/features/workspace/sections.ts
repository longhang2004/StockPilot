/**
 * Workspace section identity — the single server-safe source of truth for
 * which sections exist, whether a route value is a valid section, and the
 * canonical href for each section.
 *
 * Deliberately free of React components and icons: route validation runs in
 * the server App Router page, while component/icon mapping lives in the
 * client workspace layer that imports this module.
 */
export const WORKSPACE_SECTIONS = [
  'audit',
  'imports',
  'integrations',
  'inventory',
  'more',
  'orders',
  'partners',
  'products',
  'receipts',
  'settings',
  'overview',
] as const;

export type WorkspaceSection = (typeof WORKSPACE_SECTIONS)[number];

/**
 * Sections reachable at a URL path of their own (`/app/[section]`).
 * `overview` is a valid section but lives at the shell root (`/app`), so
 * it is deliberately NOT a dynamic section: `/app/overview` must keep its
 * historical fallback behavior instead of rendering Overview.
 */
export type DynamicWorkspaceSection = Exclude<WorkspaceSection, 'overview'>;

export function isWorkspaceSection(value: string): value is WorkspaceSection {
  return (WORKSPACE_SECTIONS as readonly string[]).includes(value);
}

export function isDynamicWorkspaceSection(
  value: string,
): value is DynamicWorkspaceSection {
  return value !== 'overview' && isWorkspaceSection(value);
}

/** Canonical href for a section (overview lives at the shell root). */
export function workspaceSectionHref(section: WorkspaceSection): string {
  return section === 'overview' ? '/app' : `/app/${section}`;
}

/** Human-readable navigation labels (server-safe, no icons). */
export const WORKSPACE_SECTION_LABELS: Readonly<
  Record<WorkspaceSection, string>
> = {
  audit: 'Audit',
  imports: 'Imports',
  integrations: 'Integrations',
  inventory: 'Inventory',
  more: 'More',
  orders: 'Orders',
  overview: 'Overview',
  partners: 'Partners',
  products: 'Products',
  receipts: 'Receipts',
  settings: 'Settings',
};
