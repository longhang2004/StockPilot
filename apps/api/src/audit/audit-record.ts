import type { Prisma } from '../generated/prisma/client.js';

export interface AuditRecordInput {
  action: string;
  actorUserId: string;
  after?: unknown;
  before?: unknown;
  entityId: string;
  entityType: string;
  organizationId: string;
}

export function recordAudit(
  transaction: Prisma.TransactionClient,
  input: AuditRecordInput,
) {
  const data: Prisma.AuditEventUncheckedCreateInput = {
    action: input.action,
    actorUserId: input.actorUserId,
    entityId: input.entityId,
    entityType: input.entityType,
    organizationId: input.organizationId,
  };
  if (input.after !== undefined) data.after = toJson(input.after);
  if (input.before !== undefined) data.before = toJson(input.before);
  return transaction.auditEvent.create({
    data,
  });
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
