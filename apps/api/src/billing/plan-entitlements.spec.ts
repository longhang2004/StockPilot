import { describe, expect, it } from 'vitest';

import { entitlementsFor } from './plan-entitlements.js';

describe('plan entitlements', () => {
  it('gives Starter a three-member team without advanced features', () => {
    expect(entitlementsFor('STARTER')).toEqual({
      csvImport: false,
      integrations: false,
      maxTeamMembers: 3,
    });
  });

  it('gives Pro a twenty-member team with advanced features', () => {
    expect(entitlementsFor('PRO')).toEqual({
      csvImport: true,
      integrations: true,
      maxTeamMembers: 20,
    });
  });
});
