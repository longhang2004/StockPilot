import type { Environment } from '../config/environment.js';

export interface SessionCookieResponse {
  clearCookie(
    name: string,
    options: {
      httpOnly: boolean;
      path: string;
      sameSite: 'lax';
      secure: boolean;
    },
  ): void;
  cookie(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      maxAge: number;
      path: string;
      sameSite: 'lax';
      secure: boolean;
    },
  ): void;
}

export function setSessionCookie(
  environment: Environment,
  response: SessionCookieResponse,
  rawToken: string,
): void {
  response.cookie(environment.SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    maxAge: environment.SESSION_TTL_HOURS * 60 * 60 * 1000,
    path: '/',
    sameSite: 'lax',
    secure: environment.NODE_ENV === 'production',
  });
}

export function clearSessionCookie(
  environment: Environment,
  response: SessionCookieResponse,
): void {
  response.clearCookie(environment.SESSION_COOKIE_NAME, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: environment.NODE_ENV === 'production',
  });
}
