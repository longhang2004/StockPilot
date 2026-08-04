import {
  WorkspaceShell,
  type WorkspaceSection,
} from '../../../components/app/workspace-shell';

const sections = new Set([
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
]);

export default async function WorkspaceSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const selected = sections.has(section) ? section : 'more';
  return <WorkspaceShell section={selected as WorkspaceSection} />;
}
