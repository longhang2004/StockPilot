import {
  isWorkspaceSection,
} from '../../../features/workspace/sections';
import { WorkspaceShell } from '../../../components/app/workspace-shell';

export default async function WorkspaceSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const selected = isWorkspaceSection(section) ? section : 'more';
  return <WorkspaceShell section={selected} />;
}
