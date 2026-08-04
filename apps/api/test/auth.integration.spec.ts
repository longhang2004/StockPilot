import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from 'argon2';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('authentication API', () => {
  const adminDatabaseUrl =
    'postgresql://stockpilot_admin:stockpilot_admin@localhost:5432/stockpilot';
  const appDatabaseUrl =
    'postgresql://stockpilot_app:stockpilot_app@localhost:5432/stockpilot';
  const webOrigin = 'http://localhost:3000';
  const demoSlug = `auth-test-${randomUUID()}`;
  let app: INestApplication;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;

  async function createAdminClient() {
    const { createPrismaClient } =
      await import('../src/database/prisma-client.js');
    return createPrismaClient(adminDatabaseUrl);
  }

  beforeAll(async () => {
    Object.assign(process.env, {
      CSRF_SECRET: 'integration-csrf-secret-with-at-least-32-characters',
      DATABASE_URL: appDatabaseUrl,
      DEMO_MODE: 'true',
      DEMO_ORGANIZATION_SLUG: demoSlug,
      NODE_ENV: 'test',
      SESSION_COOKIE_NAME: 'stockpilot_session',
      SESSION_TTL_HOURS: '12',
      WEB_ORIGIN: webOrigin,
      WEBHOOK_SIGNING_SECRET: 'integration-webhook-secret',
    });

    admin = await createAdminClient();
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

    const [{ AppModule }, { configureApplication }] = await Promise.all([
      import('../src/app.module.js'),
      import('../src/configure-application.js'),
    ]);
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
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
      .set('Origin', webOrigin)
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
    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post('/v1/auth/demo-login')
      .set('Origin', webOrigin)
      .send({ role: 'MANAGER' });

    const session = await agent.get('/v1/auth/session');
    expect(session.status).toBe(200);
    expect(session.body.membership.role).toBe('MANAGER');

    const rejectedLogout = await agent
      .post('/v1/auth/logout')
      .set('Origin', webOrigin);
    expect(rejectedLogout.status).toBe(403);

    const logout = await agent
      .post('/v1/auth/logout')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', login.body.csrfToken);
    expect(logout.status).toBe(204);

    const revokedSession = await agent.get('/v1/auth/session');
    expect(revokedSession.status).toBe(401);
  });

  it('rejects credential login with an invalid password', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('Origin', webOrigin)
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
