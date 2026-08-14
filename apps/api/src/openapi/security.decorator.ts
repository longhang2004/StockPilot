import { applyDecorators } from '@nestjs/common';
import { ApiHeader, ApiSecurity } from '@nestjs/swagger';

/**
 * Declares the `sessionCookie` security scheme (defined in
 * configure-application.ts) for protected endpoints. Public routes must NOT
 * carry these decorators.
 *
 * The CSRF documentation matches runtime behavior (see csrf.guard.ts): a
 * browser write with a session must send the token returned by
 * login/signup/session in the `X-CSRF-Token` header, and every non-safe
 * request must come from the trusted `WEB_ORIGIN`.
 */
export function SessionAuth(): MethodDecorator & ClassDecorator {
  return ApiSecurity('sessionCookie');
}

/** Session auth plus the CSRF token header required for browser writes. */
export function SessionAuthWrite(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiSecurity('sessionCookie'),
    ApiHeader({
      name: 'X-CSRF-Token',
      required: true,
      description:
        'CSRF token returned by login/signup/demo-login/switch-workspace ' +
        'responses (and by GET /v1/auth/csrf). Required for browser writes ' +
        'with a session; the request must also originate from the trusted ' +
        'WEB_ORIGIN.',
    }),
  );
}
