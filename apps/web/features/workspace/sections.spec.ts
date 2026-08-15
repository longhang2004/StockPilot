import { describe, expect, it } from 'vitest';

import {
  isDynamicWorkspaceSection,
  isWorkspaceSection,
  WORKSPACE_SECTIONS,
  workspaceSectionHref,
  type WorkspaceSection,
} from './sections';

describe('workspace section registry', () => {
  it('keeps overview a valid workspace section with the shell-root href', () => {
    expect(isWorkspaceSection('overview')).toBe(true);
    expect(workspaceSectionHref('overview')).toBe('/app');
    expect(workspaceSectionHref('orders')).toBe('/app/orders');
  });

  it('treats overview as NOT a dynamic section (it lives at /app)', () => {
    expect(isDynamicWorkspaceSection('overview')).toBe(false);
    // The historical fallback: /app/overview resolves to the `more` section.
    expect(isDynamicWorkspaceSection('overview') ? 'overview' : 'more').toBe(
      'more',
    );
  });

  it('accepts every other section as a dynamic section', () => {
    for (const section of WORKSPACE_SECTIONS) {
      if (section === 'overview') continue;
      expect(
        isDynamicWorkspaceSection(section),
        `${section} must be dynamic`,
      ).toBe(true);
      expect(workspaceSectionHref(section), `${section} href`).toBe(
        `/app/${section}`,
      );
    }
  });

  it('rejects unknown values for both predicates (fallback to more)', () => {
    for (const unknown of ['bogus', '', 'Overview', 'overview/', 'app']) {
      expect(isWorkspaceSection(unknown), `${unknown}`).toBe(false);
      expect(isDynamicWorkspaceSection(unknown), `${unknown}`).toBe(false);
    }
  });

  it('types the dynamic predicate as a narrowing guard', () => {
    const value: string = 'orders';
    if (isDynamicWorkspaceSection(value)) {
      const section: WorkspaceSection = value;
      expect(section).toBe('orders');
    }
  });
});
