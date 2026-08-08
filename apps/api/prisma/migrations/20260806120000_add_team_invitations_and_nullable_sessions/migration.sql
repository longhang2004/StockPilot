-- Team invitations: tenant-owned, token-hashed, single-use, expiring.
-- Sessions may exist without a membership so that a freshly signed-up user
-- can create their first workspace before joining one.

CREATE TABLE "organization_invitations" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "role" "Role" NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "invited_by_user_id" UUID NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "accepted_at" TIMESTAMPTZ(3),
  "revoked_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- At most one ACTIVE (pending) invitation per email per workspace. Revoked or
-- accepted invitations must NOT block a future re-invitation, so the
-- uniqueness is partial over the pending state only.
-- NOTE: Prisma cannot express partial unique indexes in schema.prisma, so
-- this index exists only in SQL. `prisma migrate dev` reports it as drift;
-- never generate a migration that drops it. CI and deploys use
-- `prisma migrate deploy`, which does not drift-check.
CREATE UNIQUE INDEX "organization_invitations_active_email_key" ON "organization_invitations"("organization_id", "email") WHERE "accepted_at" IS NULL AND "revoked_at" IS NULL;
CREATE UNIQUE INDEX "organization_invitations_token_hash_key" ON "organization_invitations"("token_hash");
CREATE INDEX "organization_invitations_organization_id_email_idx" ON "organization_invitations"("organization_id", "email");
CREATE INDEX "organization_invitations_email_idx" ON "organization_invitations"("email");
CREATE INDEX "organization_invitations_expires_at_idx" ON "organization_invitations"("expires_at");

-- Runtime privileges: read/list/revoke/accept are all row updates in a
-- tenant-scoped transaction. DELETE is intentionally not granted; cascading
-- workspace deletion owns cleanup.
GRANT SELECT, INSERT, UPDATE ON TABLE "organization_invitations" TO stockpilot_app;

ALTER TABLE "organization_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_invitations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "organization_invitations_tenant_isolation" ON "organization_invitations"
  FOR ALL
  TO stockpilot_app
  USING (
    "organization_id" = NULLIF(
      current_setting('app.current_org_id', true),
      ''
    )::uuid
  )
  WITH CHECK (
    "organization_id" = NULLIF(
      current_setting('app.current_org_id', true),
      ''
    )::uuid
  );

-- Invitation acceptance is the one flow that must resolve a row before the
-- invitee holds a membership, so the organization context is not known yet.
-- Like stockpilot_reset_demo_data, this is a narrow SECURITY DEFINER lookup:
-- it only returns invitation state for a supplied token hash. The acceptance
-- mutation itself still runs inside a tenant-scoped transaction under RLS.
-- The function can never write: it is a read-only projector with EXECUTE
-- revoked from PUBLIC and granted only to the runtime role.
CREATE OR REPLACE FUNCTION stockpilot_resolve_invitation(lookup_token_hash CHAR(64))
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  email VARCHAR(320),
  role "Role",
  expires_at TIMESTAMPTZ(3),
  accepted_at TIMESTAMPTZ(3),
  revoked_at TIMESTAMPTZ(3)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      inv."id",
      inv."organization_id",
      inv."email",
      inv."role",
      inv."expires_at",
      inv."accepted_at",
      inv."revoked_at"
    FROM public."organization_invitations" AS inv
   WHERE inv."token_hash" = lookup_token_hash;
END;
$$;

REVOKE EXECUTE ON FUNCTION stockpilot_resolve_invitation(CHAR(64)) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stockpilot_resolve_invitation(CHAR(64)) TO stockpilot_app;

-- Signup happens before a workspace exists: a session no longer requires a
-- membership, so onboarding can authenticate the user while they create their
-- first organization. Workspace-scoped routes still reject membershipless
-- sessions via the permission guard. Sessions always carry the owning user.
--
-- The sessions table may already contain rows on an existing deployment, so
-- the column is added nullable, backfilled from each session's membership,
-- and only then constrained. Every legacy session had a membership_id
-- (NOT NULL in the prior schema) and memberships cascade-delete their
-- sessions, so the backfill is total; the guard below fails the migration
-- loudly instead of silently leaving orphans if that assumption ever breaks.
ALTER TABLE "sessions" ALTER COLUMN "membership_id" DROP NOT NULL;

ALTER TABLE "sessions" ADD COLUMN "user_id" UUID;

UPDATE "sessions" AS s
   SET "user_id" = m."user_id"
  FROM "memberships" AS m
 WHERE s."membership_id" = m."id";

DO $$
DECLARE
  unresolved BIGINT;
BEGIN
  SELECT count(*) INTO unresolved FROM "sessions" WHERE "user_id" IS NULL;
  IF unresolved > 0 THEN
    RAISE EXCEPTION
      'Cannot backfill user_id for % session row(s); migration aborted.',
      unresolved;
  END IF;
END;
$$;

ALTER TABLE "sessions" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
