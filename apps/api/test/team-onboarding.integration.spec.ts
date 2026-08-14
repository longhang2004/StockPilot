import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { hashSessionToken } from '../src/auth/session-credentials.js';
import {
  adminDatabaseUrl,
  setTestEnvironment,
  TEST_WEB_ORIGIN,
} from './support/environment.js';
import {
  createAdminClient,
  createTestApplication,
} from './support/test-app.js';

describe('team onboarding and workspace control plane', () => {
  const slug = `team-test-${randomUUID()}`;
  let app: INestApplication;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;
  let ownerAgent: ReturnType<typeof request.agent>;
  let ownerMembershipId: string;
  let organizationId: string;
  let managerInviteToken: string;
  const csrfByAgent = new WeakMap<object, string>();

  function captureCsrf(agent: object, body: { csrfToken?: string }): void {
    if (body?.csrfToken) csrfByAgent.set(agent, body.csrfToken);
  }

  function api(
    agent: ReturnType<typeof request.agent>,
    method: 'delete' | 'get' | 'patch' | 'post',
    path: string,
  ) {
    const requestBuilder = agent[method](`/v1${path}`);
    if (method !== 'get') {
      requestBuilder.set('Origin', TEST_WEB_ORIGIN);
      const csrfToken = csrfByAgent.get(agent);
      if (csrfToken) requestBuilder.set('X-CSRF-Token', csrfToken);
    }
    return requestBuilder;
  }

  beforeAll(async () => {
    setTestEnvironment({ DEMO_ORGANIZATION_SLUG: slug });

    admin = await createAdminClient(adminDatabaseUrl());

    ({ app } = await createTestApplication());

    // Owner signs up their own workspace through the public API. The id is
    // captured from the signup response: pre-creating the same email through
    // the admin client would collide with the signup duplicate check.
    ownerAgent = request.agent(app.getHttpServer());
    const signup = await api(ownerAgent, 'post', '/auth/signup')
      .send({
        displayName: 'Owner One',
        email: `${slug}-owner@stockpilot.test`,
        password: 'DemoPass123!',
      })
      .expect(201);
    captureCsrf(ownerAgent, signup.body);
    expect(signup.body.membership).toBeNull();

    const workspace = await api(ownerAgent, 'post', '/organizations')
      .send({ name: slug })
      .expect(201);
    captureCsrf(ownerAgent, workspace.body);
    expect(workspace.body.membership.role).toBe('OWNER');
    organizationId = workspace.body.membership.organization.id;
    ownerMembershipId = workspace.body.membership.id;

    // The workspace runs on an active Pro subscription (limit 20) so the
    // invitation lifecycle tests below are not constrained by the Starter
    // three-seat limit; the seat-limit regressions live in the billing suite,
    // which can downgrade through real webhook synchronization.
    await admin.organizationSubscription.create({
      data: {
        organizationId,
        plan: 'PRO',
        status: 'ACTIVE',
        stripeCustomerId: 'cus_team_test',
        stripeSubscriptionId: 'sub_team_test',
      },
    });
  });

  afterAll(async () => {
    await app?.close();
    if (admin) {
      await admin.organization.deleteMany({
        where: { slug: { startsWith: slug } },
      });
      await admin.user.deleteMany({
        // Scoped to this suite: parallel suites share the database and a
        // global email filter would delete their users mid-run.
        where: { email: { startsWith: `${slug}-` } },
      });
    }
  });

  it('signs up, creates a workspace, and invites a Manager', async () => {
    const invite = await api(ownerAgent, 'post', '/team/invitations')
      .send({ email: `${slug}-manager@stockpilot.test`, role: 'MANAGER' })
      .expect(201);
    expect(invite.body.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    managerInviteToken = invite.body.rawToken;
  });

  it('persists only the hashed invitation token and never the raw token', async () => {
    const stored = await admin.organizationInvitation.findFirst({
      where: {
        email: `${slug}-manager@stockpilot.test`,
        organizationId,
      },
    });
    expect(stored).not.toBeNull();
    expect(stored?.tokenHash).toBe(hashSessionToken(managerInviteToken));
    expect(stored?.tokenHash).not.toBe(managerInviteToken);

    const audit = await admin.auditEvent.findFirst({
      orderBy: { createdAt: 'desc' },
      where: { action: 'TEAM_MEMBER_INVITED' },
    });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit)).not.toContain(managerInviteToken);
  });

  it('rejects duplicate invitations and already-members', async () => {
    const memberConflict = await api(ownerAgent, 'post', '/team/invitations')
      .send({ email: `${slug}-owner@stockpilot.test`, role: 'MANAGER' })
      .expect(409);
    expect(memberConflict.body.code).toBe('ALREADY_A_MEMBER');

    const duplicate = await api(ownerAgent, 'post', '/team/invitations')
      .send({ email: `${slug}-manager@stockpilot.test`, role: 'MANAGER' })
      .expect(409);
    expect(duplicate.body.code).toBe('INVITATION_ALREADY_PENDING');
  });

  it('lets the invited Manager sign up and accept into the invited role', async () => {
    const managerAgent = request.agent(app.getHttpServer());
    await api(managerAgent, 'post', '/auth/signup')
      .send({
        displayName: 'Manager Two',
        email: `${slug}-manager@stockpilot.test`,
        password: 'DemoPass123!',
      })
      .expect(201)
      .then((response) => captureCsrf(managerAgent, response.body));

    const accepted = await api(managerAgent, 'post', '/team/invitations/accept')
      .send({ token: managerInviteToken })
      .expect(200);
    captureCsrf(managerAgent, accepted.body);
    expect(accepted.body.membership.organization.id).toBe(organizationId);
    expect(accepted.body.membership.role).toBe('MANAGER');

    const secondAccept = await api(
      managerAgent,
      'post',
      '/team/invitations/accept',
    )
      .send({ token: managerInviteToken })
      .expect(409);
    expect(secondAccept.body.code).toBe('INVITATION_ALREADY_ACCEPTED');

    // The new member is visible to the Owner's team list (team:read is
    // Owner-only, so the Manager cannot list the team themselves).
    const members = await api(ownerAgent, 'get', '/team').expect(200);
    expect(
      members.body.some(
        (member: { email: string }) =>
          member.email === `${slug}-manager@stockpilot.test`,
      ),
    ).toBe(true);
  });

  it('rejects expired and revoked invitations', async () => {
    const invite = await api(ownerAgent, 'post', '/team/invitations')
      .send({ email: `${slug}-expired@stockpilot.test`, role: 'MANAGER' })
      .expect(201);
    const invitee = request.agent(app.getHttpServer());
    await api(invitee, 'post', '/auth/signup')
      .send({
        displayName: 'Expired User',
        email: `${slug}-expired@stockpilot.test`,
        password: 'DemoPass123!',
      })
      .expect(201)
      .then((response) => captureCsrf(invitee, response.body));

    await admin.organizationInvitation.update({
      data: { expiresAt: new Date(Date.now() - 60_000) },
      where: { id: invite.body.id },
    });
    const expired = await api(invitee, 'post', '/team/invitations/accept')
      .send({ token: invite.body.rawToken })
      .expect(409);
    expect(expired.body.code).toBe('INVITATION_EXPIRED');

    const revoked = await api(ownerAgent, 'post', '/team/invitations')
      .send({ email: `${slug}-revoked@stockpilot.test`, role: 'MANAGER' })
      .expect(201);
    await api(
      ownerAgent,
      'post',
      `/team/invitations/${revoked.body.id}/revoke`,
    ).expect(200);
    const revokedAccept = await api(invitee, 'post', '/team/invitations/accept')
      .send({ token: revoked.body.rawToken })
      .expect(409);
    expect(revokedAccept.body.code).toBe('INVITATION_REVOKED');
  });

  it('enforces email identity on acceptance and forbids Owner invites', async () => {
    const invite = await api(ownerAgent, 'post', '/team/invitations')
      .send({ email: `${slug}-someone@stockpilot.test`, role: 'MANAGER' })
      .expect(201);
    const wrongUser = request.agent(app.getHttpServer());
    await api(wrongUser, 'post', '/auth/signup')
      .send({
        displayName: 'Wrong User',
        email: `${slug}-wrong@stockpilot.test`,
        password: 'DemoPass123!',
      })
      .expect(201)
      .then((response) => captureCsrf(wrongUser, response.body));
    const mismatch = await api(wrongUser, 'post', '/team/invitations/accept')
      .send({ token: invite.body.rawToken })
      .expect(403);
    expect(mismatch.body.code).toBe('INVITATION_EMAIL_MISMATCH');

    const ownerInvite = await api(ownerAgent, 'post', '/team/invitations')
      .send({ email: `${slug}-owner2@stockpilot.test`, role: 'OWNER' })
      .expect(403);
    expect(ownerInvite.body.code).toBe('FORBIDDEN_ROLE_CHANGE');
  });

  it('blocks Staff from inviting or mutating the team', async () => {
    const staffAgent = request.agent(app.getHttpServer());
    await api(staffAgent, 'post', '/auth/signup')
      .send({
        displayName: 'Staff Three',
        email: `${slug}-staff3@stockpilot.test`,
        password: 'DemoPass123!',
      })
      .expect(201)
      .then((response) => captureCsrf(staffAgent, response.body));
    // Join the main workspace as a real STAFF member first.
    const invite = await api(ownerAgent, 'post', '/team/invitations')
      .send({ email: `${slug}-staff3@stockpilot.test`, role: 'STAFF' })
      .expect(201);
    const accepted = await api(staffAgent, 'post', '/team/invitations/accept')
      .send({ token: invite.body.rawToken })
      .expect(200);
    captureCsrf(staffAgent, accepted.body);

    await api(staffAgent, 'post', '/team/invitations')
      .send({ email: `${slug}-x@stockpilot.test`, role: 'MANAGER' })
      .expect(403);
    await api(staffAgent, 'patch', `/team/members/${ownerMembershipId}/role`)
      .send({ role: 'STAFF' })
      .expect(403);
    await api(
      staffAgent,
      'delete',
      `/team/members/${ownerMembershipId}`,
    ).expect(403);
  });

  it('lets the Owner change roles but never remove or demote the last Owner', async () => {
    // The already-accepted Manager provides the non-owner membership (a user
    // can only hold one membership per organization).
    const managerMembership = await admin.membership.findFirstOrThrow({
      where: {
        organizationId,
        user: { email: `${slug}-manager@stockpilot.test` },
      },
    });
    await api(ownerAgent, 'patch', `/team/members/${managerMembership.id}/role`)
      .send({ role: 'STAFF' })
      .expect(200);

    const demote = await api(
      ownerAgent,
      'patch',
      `/team/members/${ownerMembershipId}/role`,
    )
      .send({ role: 'MANAGER' })
      .expect(409);
    expect(demote.body.code).toBe('LAST_OWNER_REQUIRED');

    const remove = await api(
      ownerAgent,
      'delete',
      `/team/members/${ownerMembershipId}`,
    ).expect(409);
    expect(remove.body.code).toBe('LAST_OWNER_REQUIRED');
  });

  it('verifies membership before switching workspaces', async () => {
    const workspaces = await api(ownerAgent, 'get', '/auth/workspaces').expect(
      200,
    );
    expect(workspaces.body).toHaveLength(1);
    expect(workspaces.body[0].organization.id).toBe(organizationId);

    const foreign = await admin.organization.create({
      data: {
        isDemo: false,
        name: 'Foreign Wholesale',
        slug: `${slug}-foreign`,
      },
    });
    const denied = await api(ownerAgent, 'post', '/auth/switch-workspace')
      .send({ organizationId: foreign.id })
      .expect(403);
    expect(denied.body.code).toBe('INVALID_WORKSPACE_MEMBERSHIP');

    const switched = await api(ownerAgent, 'post', '/auth/switch-workspace')
      .send({ organizationId })
      .expect(200);
    captureCsrf(ownerAgent, switched.body);
    expect(switched.body.membership.organization.id).toBe(organizationId);
  });

  it('keeps invitations tenant-scoped under RLS', async () => {
    const foreignOwner = request.agent(app.getHttpServer());
    await api(foreignOwner, 'post', '/auth/signup')
      .send({
        displayName: 'Foreign Owner',
        email: `${slug}-foreign-owner@stockpilot.test`,
        password: 'DemoPass123!',
      })
      .expect(201)
      .then((response) => captureCsrf(foreignOwner, response.body));
    await api(foreignOwner, 'post', '/organizations')
      .send({ name: `${slug}-foreign-b` })
      .expect(201)
      .then((response) => captureCsrf(foreignOwner, response.body));

    const list = await api(foreignOwner, 'get', '/team/invitations').expect(
      200,
    );
    expect(
      list.body.some(
        (invitation: { email: string }) =>
          invitation.email === `${slug}-someone@stockpilot.test`,
      ),
    ).toBe(false);

    // A foreign owner cannot mutate another workspace's memberships even
    // with a known membership id (memberships are not RLS-protected, so the
    // org-scoped lookup is the isolation boundary).
    const crossTenantRole = await api(
      foreignOwner,
      'patch',
      `/team/members/${ownerMembershipId}/role`,
    )
      .send({ role: 'STAFF' })
      .expect(404);
    expect(crossTenantRole.body.code).toBe('MEMBER_NOT_FOUND');
  });

  it('permits re-invitation after a revocation', async () => {
    const email = `${slug}-rein@stockpilot.test`;
    const first = await api(ownerAgent, 'post', '/team/invitations')
      .send({ email, role: 'MANAGER' })
      .expect(201);
    await api(
      ownerAgent,
      'post',
      `/team/invitations/${first.body.id}/revoke`,
    ).expect(200);
    // A revoked invitation must not permanently consume the (org, email)
    // pair: the partial unique index only covers pending invitations.
    const second = await api(ownerAgent, 'post', '/team/invitations')
      .send({ email, role: 'STAFF' })
      .expect(201);
    expect(second.body.id).not.toBe(first.body.id);
  });

  it('permits re-invitation after acceptance and later removal', async () => {
    const email = `${slug}-rein2@stockpilot.test`;
    const invite = await api(ownerAgent, 'post', '/team/invitations')
      .send({ email, role: 'MANAGER' })
      .expect(201);
    const member = request.agent(app.getHttpServer());
    await api(member, 'post', '/auth/signup')
      .send({
        displayName: 'Reinvite User',
        email,
        password: 'DemoPass123!',
      })
      .expect(201)
      .then((response) => captureCsrf(member, response.body));
    const accepted = await api(member, 'post', '/team/invitations/accept')
      .send({ token: invite.body.rawToken })
      .expect(200);
    await api(
      ownerAgent,
      'delete',
      `/team/members/${accepted.body.membership.id}`,
    ).expect(200);
    const again = await api(ownerAgent, 'post', '/team/invitations')
      .send({ email, role: 'MANAGER' })
      .expect(201);
    expect(again.body.email).toBe(email);
  });

  it('creates a single membership when one invitation is accepted concurrently', async () => {
    const email = `${slug}-race@stockpilot.test`;
    const invite = await api(ownerAgent, 'post', '/team/invitations')
      .send({ email, role: 'STAFF' })
      .expect(201);
    const racer = request.agent(app.getHttpServer());
    await api(racer, 'post', '/auth/signup')
      .send({
        displayName: 'Race User',
        email,
        password: 'DemoPass123!',
      })
      .expect(201)
      .then((response) => captureCsrf(racer, response.body));

    const [first, second] = await Promise.all([
      api(racer, 'post', '/team/invitations/accept')
        .send({ token: invite.body.rawToken })
        .then((response) => response.status),
      api(racer, 'post', '/team/invitations/accept')
        .send({ token: invite.body.rawToken })
        .then((response) => response.status),
    ]);
    expect([first, second].sort()).toEqual([200, 409]);
    const memberships = await admin.membership.count({
      where: {
        organizationId,
        user: { email },
      },
    });
    expect(memberships).toBe(1);
    const invitation = await admin.organizationInvitation.findUnique({
      where: { id: invite.body.id },
    });
    expect(invitation?.acceptedAt).not.toBeNull();
  });

  it('keeps exactly one Owner when two Owners are demoted concurrently', async () => {
    // Promote a second Owner through the API.
    const email = `${slug}-coowner@stockpilot.test`;
    const invite = await api(ownerAgent, 'post', '/team/invitations')
      .send({ email, role: 'MANAGER' })
      .expect(201);
    const coOwner = request.agent(app.getHttpServer());
    await api(coOwner, 'post', '/auth/signup')
      .send({
        displayName: 'Co Owner',
        email,
        password: 'DemoPass123!',
      })
      .expect(201)
      .then((response) => captureCsrf(coOwner, response.body));
    const accepted = await api(coOwner, 'post', '/team/invitations/accept')
      .send({ token: invite.body.rawToken })
      .expect(200);
    const coOwnerMembershipId = accepted.body.membership.id;
    await api(ownerAgent, 'patch', `/team/members/${coOwnerMembershipId}/role`)
      .send({ role: 'OWNER' })
      .expect(200);

    // Demote both Owners at once: the per-workspace advisory lock serializes
    // the count-then-mutate, so exactly one demotion may succeed. The second
    // request fails either with LAST_OWNER_REQUIRED (it still held OWNER
    // when it ran) or with 403 (it had already been demoted and lost
    // team:write) — both preserve the invariant.
    const [a, b] = await Promise.all([
      api(ownerAgent, 'patch', `/team/members/${ownerMembershipId}/role`)
        .send({ role: 'MANAGER' })
        .then((response) => response.status),
      api(coOwner, 'patch', `/team/members/${coOwnerMembershipId}/role`)
        .send({ role: 'MANAGER' })
        .then((response) => response.status),
    ]);
    expect([a, b].sort()[0]).toBe(200);
    expect([403, 409]).toContain([a, b].sort()[1]);
    const owners = await admin.membership.count({
      where: { organizationId, role: 'OWNER' },
    });
    expect(owners).toBe(1);
  });
});
