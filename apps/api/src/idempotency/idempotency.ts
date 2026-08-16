import { createHash } from 'node:crypto';

import { ConflictException } from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';

export interface IdempotentExecution<T> {
  body: T;
  replayed: boolean;
  responseStatus: number;
}

interface IdempotentRequest<T> {
  key: string;
  organizationId: string;
  payload: unknown;
  responseStatus: number;
  scope: string;
  work: () => Promise<T>;
}

export function fingerprintPayload(payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(payload)))
    .digest('hex');
}

export async function executeIdempotent<T>(
  transaction: Prisma.TransactionClient,
  request: IdempotentRequest<T>,
): Promise<IdempotentExecution<T>> {
  const fingerprint = fingerprintPayload(request.payload);
  const lockName = [request.organizationId, request.scope, request.key].join(
    ':',
  );

  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${lockName}, 0))
  `;

  // Expire-on-write: purge records whose 24h window elapsed so the table
  // cannot grow without bound under key-churn abuse. expiresAt is indexed,
  // so this stays cheap at the portfolio scale; replays of live keys are
  // unaffected because the advisory lock is per key.
  await transaction.idempotencyRecord.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  const existing = await transaction.idempotencyRecord.findUnique({
    where: {
      organizationId_scope_key: {
        key: request.key,
        organizationId: request.organizationId,
        scope: request.scope,
      },
    },
  });
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new ConflictException(
        'This Idempotency-Key was already used with a different payload.',
      );
    }
    return {
      body: existing.responseBody as T,
      replayed: true,
      responseStatus: existing.responseStatus,
    };
  }

  const result = toJson(await request.work());
  await transaction.idempotencyRecord.create({
    data: {
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      fingerprint,
      key: request.key,
      organizationId: request.organizationId,
      responseBody: result as Prisma.InputJsonValue,
      responseStatus: request.responseStatus,
      scope: request.scope,
    },
  });

  return {
    body: result as T,
    replayed: false,
    responseStatus: request.responseStatus,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter((entry) => entry[1] !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function toJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
