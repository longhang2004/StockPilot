import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { Prisma } from '../generated/prisma/client.js';
import { recordAudit } from '../audit/audit-record.js';
import { AuthService } from '../auth/auth.service.js';
import { requireMembership, type AuthContext } from '../auth/auth-context.js';
import { TenantDatabase } from '../database/tenant-database.js';

@Injectable()
export class OrganizationService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  /**
   * Atomically creates an organization, its warehouse, and the creator's
   * Owner membership, then issues a session bound to the new workspace so
   * the creator lands inside it without a second login.
   */
  async createWorkspace(auth: AuthContext, name: string) {
    const organizationId = randomUUID();
    const result = await this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
        const organization = await this.createOrganizationWithUniqueSlug(
          transaction,
          { id: organizationId, name },
        );
        const warehouse = await transaction.warehouse.create({
          data: {
            id: randomUUID(),
            name: 'Main warehouse',
            organizationId,
          },
        });
        const membership = await transaction.membership.create({
          data: {
            organizationId,
            role: 'OWNER',
            userId: auth.user.id,
          },
          include: { organization: true, user: true },
        });
        await recordAudit(transaction, {
          action: 'WORKSPACE_CREATED',
          actorUserId: auth.user.id,
          after: {
            name: organization.name,
            slug: organization.slug,
            warehouse: warehouse.name,
          },
          entityId: organizationId,
          entityType: 'Organization',
          organizationId,
        });
        return { membership };
      },
    );
    return this.authService.issueSession(result.membership, auth.user);
  }

  private async createOrganizationWithUniqueSlug(
    transaction: Prisma.TransactionClient,
    input: { id: string; name: string },
  ) {
    const slugs = this.slugCandidates(input.name);
    for (const slug of slugs) {
      try {
        return await transaction.organization.create({
          data: { id: input.id, name: input.name, slug },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          Array.isArray(error.meta?.target) &&
          error.meta.target.includes('slug')
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException(
      'Could not allocate a unique workspace slug; try a different name.',
    );
  }

  private slugCandidates(name: string): string[] {
    const base =
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'workspace';
    return [base, ...Array.from({ length: 9 }, (_, i) => `${base}-${i + 2}`)];
  }

  getSettings(auth: AuthContext) {
    const organizationId = requireMembership(auth).organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
        const [organization, warehouse] = await Promise.all([
          transaction.organization.findUnique({
            select: {
              currency: true,
              id: true,
              isDemo: true,
              name: true,
              nextDemoResetAt: true,
              slug: true,
            },
            where: { id: organizationId },
          }),
          transaction.warehouse.findUnique({
            select: { id: true, name: true },
            where: { organizationId },
          }),
        ]);
        if (!organization) {
          throw new NotFoundException('Organization not found.');
        }
        return { ...organization, warehouse };
      },
    );
  }

  listTeam(auth: AuthContext) {
    const organizationId = requireMembership(auth).organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
        const memberships = await transaction.membership.findMany({
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            role: true,
            user: { select: { displayName: true, email: true } },
          },
          where: { organizationId },
        });
        return memberships.map((membership) => ({
          displayName: membership.user.displayName,
          email: membership.user.email,
          id: membership.id,
          role: membership.role,
        }));
      },
    );
  }
}
