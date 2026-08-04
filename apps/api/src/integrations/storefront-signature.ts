import { timingSafeEqual, createHmac } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';

import type { MockStorefrontOrder } from './integration.types.js';

export function verifyStorefrontSignature(
  payload: MockStorefrontOrder,
  signature: string,
  secret: string,
) {
  const candidate = signature.replace(/^sha256=/, '').trim();
  const expected = createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  const candidateBuffer = Buffer.from(candidate, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (
    candidateBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(candidateBuffer, expectedBuffer)
  ) {
    throw new UnauthorizedException('Webhook signature is invalid.');
  }
}
