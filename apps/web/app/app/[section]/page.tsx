import { isDynamicWorkspaceSection } from '../../../features/workspace/sections';
import { WorkspaceShell } from '../../../components/app/workspace-shell';

export default async function WorkspaceSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  // Only dynamic sections are valid under /app/[section]; `overview` lives
  // at the shell root and falls back to `more` here, as it always has.
  const selected = isDynamicWorkspaceSection(section) ? section : 'more';
  return <WorkspaceShell section={selected} />;
}
