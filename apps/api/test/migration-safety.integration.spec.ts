import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const { Client } = pg;

/**
 * Regression test for the session migration in
 * 20260806120000_add_team_invitations_and_nullable_sessions: the migration
 * must apply to a database that already contains sessions. The old shape
 * (membership_id NOT NULL, no user_id) is recreated in a dedicated schema,
 * populated with representative rows, and then the exact SQL statements from
 * the migration file are executed against it. This catches the
 * deployment-blocking pattern where a NOT NULL column is added before its
 * backfill.
 */
describe('session migration safety on a populated database', () => {
  const adminDatabaseUrl =
    process.env.MIGRATION_DATABASE_URL ??
    'postgresql://stockpilot_admin:stockpilot_admin@localhost:5432/stockpilot';
  const schema = `migration_safety_${randomUUID().replaceAll('-', '')}`;
  const userIdAlice = '00000000-0000-0000-0000-000000000001';
  const userIdBob = '00000000-0000-0000-0000-000000000002';
  const membershipAlice = '00000000-0000-0000-0000-000000000011';
  const membershipBob = '00000000-0000-0000-0000-000000000012';
  let client: InstanceType<typeof Client>;

  beforeAll(async () => {
    client = new Client({ connectionString: adminDatabaseUrl });
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`
      CREATE TABLE "${schema}"."users" (
        "id" UUID NOT NULL,
        "email" VARCHAR(320) NOT NULL,
        "password_hash" TEXT NOT NULL,
        "display_name" VARCHAR(120) NOT NULL,
        "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ(3) NOT NULL,
        CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "users_email_key" UNIQUE ("email")
      )
    `);
    await client.query(`
      CREATE TABLE "${schema}"."memberships" (
        "id" UUID NOT NULL,
        "organization_id" UUID,
        "user_id" UUID NOT NULL,
        "role" "Role" NOT NULL,
        "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ(3) NOT NULL,
        CONSTRAINT "memberships_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "${schema}"."users"("id")
      )
    `);
    await client.query(`
      CREATE TABLE "${schema}"."sessions" (
        "id" UUID NOT NULL,
        "token_hash" CHAR(64) NOT NULL,
        "membership_id" UUID NOT NULL,
        "expires_at" TIMESTAMPTZ(3) NOT NULL,
        "revoked_at" TIMESTAMPTZ(3),
        "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "sessions_token_hash_key" UNIQUE ("token_hash"),
        CONSTRAINT "sessions_membership_id_fkey" FOREIGN KEY ("membership_id")
          REFERENCES "${schema}"."memberships"("id") ON DELETE CASCADE
      )
    `);
    await client.query(
      `
        INSERT INTO "${schema}"."users" ("id", "email", "password_hash", "display_name", "updated_at")
        VALUES ($1, 'alice@example.com', 'x', 'Alice', now()),
               ($2, 'bob@example.com', 'x', 'Bob', now())
      `,
      [userIdAlice, userIdBob],
    );
    await client.query(
      `
        INSERT INTO "${schema}"."memberships" ("id", "user_id", "role", "updated_at")
        VALUES ($1, $3, 'OWNER', now()),
               ($2, $4, 'STAFF', now())
      `,
      [membershipAlice, membershipBob, userIdAlice, userIdBob],
    );
    await client.query(
      `
        INSERT INTO "${schema}"."sessions" ("id", "token_hash", "membership_id", "expires_at", "last_seen_at")
        VALUES (gen_random_uuid(), repeat('a', 64), $1, now() + interval '1 day', now()),
               (gen_random_uuid(), repeat('b', 64), $1, now() + interval '1 day', now()),
               (gen_random_uuid(), repeat('c', 64), $2, now() + interval '1 day', now())
      `,
      [membershipAlice, membershipBob],
    );
  });

  afterAll(async () => {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  });

  it('applies the migration to an already-populated sessions table', async () => {
    const migrationPath = join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'prisma',
      'migrations',
      '20260806120000_add_team_invitations_and_nullable_sessions',
      'migration.sql',
    );
    const migrationSql = readFileSync(migrationPath, 'utf8');
    const sessionsSection = migrationSql
      .split('-- Signup happens before a workspace exists')[1]
      .split('\n')
      .slice(1)
      .join('\n');
    expect(sessionsSection).toContain(
      'ALTER TABLE "sessions" ADD COLUMN "user_id" UUID;',
    );
    // Run the exact statements, schema-qualified, against the populated table.
    const qualified = sessionsSection
      .replaceAll('"sessions"', `"${schema}"."sessions"`)
      .replaceAll('"memberships"', `"${schema}"."memberships"`)
      .replaceAll('"users"', `"${schema}"."users"`);
    await client.query(qualified);
  });

  it('backfills every session with its membership user and keeps data intact', async () => {
    const { rows } = await client.query(
      `
        SELECT s."id", s."user_id", m."user_id" AS expected_user
          FROM "${schema}"."sessions" AS s
          JOIN "${schema}"."memberships" AS m ON m."id" = s."membership_id"
      `,
    );
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.user_id).toBe(row.expected_user);
      expect(row.user_id).not.toBeNull();
    }
    const orphans = await client.query(
      `SELECT count(*)::int AS n FROM "${schema}"."sessions" WHERE "user_id" IS NULL`,
    );
    expect(orphans.rows[0].n).toBe(0);
  });

  it('enforces NOT NULL and the user foreign key afterward', async () => {
    const nullable = await client.query(
      `
        SELECT "is_nullable" FROM information_schema."columns"
         WHERE "table_schema" = $1 AND "table_name" = 'sessions' AND "column_name" = 'user_id'
      `,
      [schema],
    );
    expect(nullable.rows[0].is_nullable).toBe('NO');
    const fk = await client.query(
      `
        SELECT 1 FROM pg_constraint
         WHERE conrelid = '"${schema}"."sessions"'::regclass
           AND conname = 'sessions_user_id_fkey'
      `,
    );
    expect(fk.rowCount).toBe(1);
  });

  it('rejects a session without a user and allows a membershipless one', async () => {
    await expect(
      client.query(
        `
          INSERT INTO "${schema}"."sessions" ("id", "token_hash", "membership_id", "expires_at", "last_seen_at")
          VALUES (gen_random_uuid(), repeat('d', 64), NULL, now() + interval '1 day', now())
        `,
      ),
    ).rejects.toThrow(/null value in column "user_id"/);
    const inserted = await client.query(
      `
        INSERT INTO "${schema}"."sessions" ("id", "token_hash", "user_id", "membership_id", "expires_at", "last_seen_at")
        VALUES (gen_random_uuid(), repeat('e', 64), $1, NULL, now() + interval '1 day', now())
        RETURNING "user_id", "membership_id"
      `,
      [userIdBob],
    );
    expect(inserted.rows[0].user_id).toBe(userIdBob);
    expect(inserted.rows[0].membership_id).toBeNull();
  });
});
