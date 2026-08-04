import { ConflictException, NotFoundException } from '@nestjs/common';
import type { ProductInput } from '@stockpilot/contracts';

import type { AuthContext } from '../auth/auth-context.js';
import { recordAudit } from '../audit/audit-record.js';
import type { Prisma } from '../generated/prisma/client.js';
import { parseValidRows, serializeRun } from './product-csv-serializer.js';

export async function commitProductImport(
  transaction: Prisma.TransactionClient,
  auth: AuthContext,
  organizationId: string,
  id: string,
) {
  const run = await transaction.productImportRun.findFirst({
    where: { id, organizationId },
  });
  if (!run) throw new NotFoundException('Product import not found.');
  if (run.status !== 'PREVIEW') {
    throw new ConflictException('This import has already been committed.');
  }
  const rows: ProductInput[] = parseValidRows(run.validRows);
  let created = 0;
  for (const row of rows) {
    await transaction.product.create({ data: { ...row, organizationId } });
    created += 1;
  }
  const updated = await transaction.productImportRun.update({
    data: { status: 'COMMITTED' },
    where: { id },
  });
  await recordAudit(transaction, {
    action: 'PRODUCT_IMPORT_COMMITTED',
    actorUserId: auth.user.id,
    after: { created, importId: id },
    before: { rowsValid: run.rowsValid, status: run.status },
    entityId: id,
    entityType: 'ProductImportRun',
    organizationId,
  });
  return { created, run: serializeRun(updated) };
}
