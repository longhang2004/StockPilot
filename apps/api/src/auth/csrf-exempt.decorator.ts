import { SetMetadata } from '@nestjs/common';

export const CSRF_EXEMPT_ROUTE = 'stockpilot:csrf-exempt-route';
export const CsrfExempt = () => SetMetadata(CSRF_EXEMPT_ROUTE, true);
