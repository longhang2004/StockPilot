import type { INestApplication } from '@nestjs/common';
import request, { type Agent } from 'supertest';

import { TEST_WEB_ORIGIN } from './environment.js';

export type DemoRole = 'OWNER' | 'MANAGER' | 'STAFF';

/** Supertest agent bound to the application's HTTP server. */
export function createTestAgent(app: INestApplication): Agent {
  return request.agent(app.getHttpServer());
}

/**
 * One-click demo login against the suite's demo organization. Returns the
 * CSRF token for authenticated writes; the agent carries the session cookie.
 */
export async function demoLogin(
  agent: Agent,
  role: DemoRole,
  origin: string = TEST_WEB_ORIGIN,
): Promise<{ csrfToken: string }> {
  const response = await agent
    .post('/v1/auth/demo-login')
    .set('Origin', origin)
    .send({ role });
  if (response.status !== 200) {
    throw new Error(
      `demo-login(${role}) failed with ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }
  return { csrfToken: response.body.csrfToken as string };
}

/** Header object for authenticated writes on a demo-logged-in agent. */
export function csrfHeader(csrfToken: string): Record<string, string> {
  return { 'X-CSRF-Token': csrfToken };
}
