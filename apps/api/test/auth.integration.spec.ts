import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { hash } from 'argon2';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { demoLogin, createTestAgent } from './support/agent.js';
import {
  adminDatabaseUrl,
  setTestEnvironment,
  TEST_WEB_ORIGIN,
} from './support/environment.js';
import {
  createAdminClient,
  createTestApplication,
} from './support/test-app.js';

describe('authentication API', () => {
  const demoSlug = `auth-test-${randomUUID()}`;
  let app: INestApplication;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;

  beforeAll(async () => {
    setTestEnvironment({ DEMO_ORGANIZATION_SLUG: demoSlug });

    admin = await createAdminClient(adminDatabaseUrl());
    const passwordHash = await hash('DemoPass123!');
    const organization = await admin.organization.create({
      data: {
        isDemo: true,
        name: 'Authentication Test Wholesale',
        slug: demoSlug,
      },
    });
    const user = await admin.user.create({
      data: {
        displayName: 'Morgan Manager',
        email: `${demoSlug}@stockpilot.test`,
        passwordHash,
      },
    });
    await admin.membership.create({
      data: {
        organizationId: organization.id,
        role: 'MANAGER',
        userId: user.id,
      },
    });

    ({ app } = await createTestApplication());
  });

  afterAll(async () => {
    await app?.close();
    if (admin) {
      await admin.organization.deleteMany({ where: { slug: demoSlug } });
      await admin.user.deleteMany({
        where: { email: `${demoSlug}@stockpilot.test` },
      });
      await admin.$disconnect();
    }
  });

  it('creates an opaque demo session with hardened cookie flags', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/demo-login')
      .set('Origin', TEST_WEB_ORIGIN)
      .send({ role: 'MANAGER' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      csrfToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      membership: {
        organization: { name: 'Authentication Test Wholesale' },
        role: 'MANAGER',
      },
      user: { displayName: 'Morgan Manager' },
    });
    expect(response.headers['set-cookie']?.[0]).toMatch(
      /stockpilot_session=.*HttpOnly.*SameSite=Lax/,
    );
  });

  it('loads the active session and revokes it only with a valid CSRF token', async () => {
    const agent = createTestAgent(app);
    const { csrfToken } = await demoLogin(agent, 'MANAGER');

    const session = await agent.get('/v1/auth/session');
    expect(session.status).toBe(200);
    expect(session.body.membership.role).toBe('MANAGER');

    const rejectedLogout = await agent
      .post('/v1/auth/logout')
      .set('Origin', TEST_WEB_ORIGIN);
    expect(rejectedLogout.status).toBe(403);

    const logout = await agent
      .post('/v1/auth/logout')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', csrfToken);
    expect(logout.status).toBe(204);

    const revokedSession = await agent.get('/v1/auth/session');
    expect(revokedSession.status).toBe(401);
  });

  it('rejects credential login with an invalid password', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('Origin', TEST_WEB_ORIGIN)
      .send({
        email: `${demoSlug}@stockpilot.test`,
        password: 'wrong-password',
      });

    expect(response.status).toBe(401);
  });

  it('rejects state changes from an untrusted origin', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/demo-login')
      .set('Origin', 'https://evil.example')
      .send({ role: 'MANAGER' });

    expect(response.status).toBe(403);
  });
});
