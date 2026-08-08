-- SaaS subscription billing: one subscription row per workspace, synced from
-- signed, deduplicated Stripe webhooks; webhook events are bookkeeping rows.

CREATE TYPE "Plan" AS ENUM ('STARTER', 'PRO');
CREATE TYPE "SubscriptionStatus" AS ENUM (
  'INCOMPLETE',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'UNPAID',
  'TRIALING'
);

CREATE TABLE "organization_subscriptions" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "plan" "Plan" NOT NULL,
  "status" "SubscriptionStatus" NOT NULL,
  "stripe_customer_id" VARCHAR(80),
  "stripe_subscription_id" VARCHAR(80),
  "stripe_price_id" VARCHAR(80),
  "current_period_end" TIMESTAMPTZ(3),
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_subscriptions_organization_id_key" ON "organization_subscriptions"("organization_id");
CREATE INDEX "organization_subscriptions_stripe_subscription_id_idx" ON "organization_subscriptions"("stripe_subscription_id");

ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE ON TABLE "organization_subscriptions" TO stockpilot_app;

ALTER TABLE "organization_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_subscriptions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "organization_subscriptions_tenant_isolation" ON "organization_subscriptions"
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

CREATE TABLE "billing_webhook_events" (
  "id" UUID NOT NULL,
  "stripe_event_id" VARCHAR(160) NOT NULL,
  "event_type" VARCHAR(120) NOT NULL,
  "organization_id" UUID,
  "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_webhook_events_stripe_event_id_key" ON "billing_webhook_events"("stripe_event_id");
CREATE INDEX "billing_webhook_events_organization_id_idx" ON "billing_webhook_events"("organization_id");

GRANT SELECT, INSERT ON TABLE "billing_webhook_events" TO stockpilot_app;

-- Webhook processing runs without a user session, so it cannot set tenant
-- context for RLS. Like stockpilot_reset_demo_data and
-- stockpilot_resolve_invitation, this is a narrow SECURITY DEFINER function.
-- It is also the webhook's idempotency boundary: the Stripe event id is
-- claimed first (INSERT ... ON CONFLICT DO NOTHING inside the same
-- transaction as the subscription upsert and the audit row), so a duplicate
-- delivery — including Stripe's own retries — can never re-apply the business
-- mutation. A failed transaction rolls the claim back and the retry runs
-- cleanly. EXECUTE is revoked from PUBLIC and granted only to the runtime
-- role; all object references are schema-qualified.
CREATE OR REPLACE FUNCTION stockpilot_sync_subscription(
  event_id VARCHAR(160),
  event_type VARCHAR(120),
  target_organization_id UUID,
  event_customer_id VARCHAR(80),
  subscription_id VARCHAR(80),
  price_id VARCHAR(80),
  plan_value "Plan",
  status_value "SubscriptionStatus",
  period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_id UUID;
  now_ts TIMESTAMPTZ := now();
  entity_id UUID;
BEGIN
  -- Claim the event id atomically. A duplicate delivery finds the existing
  -- row and returns without touching subscriptions or audit.
  INSERT INTO public."billing_webhook_events" (
    "id",
    "stripe_event_id",
    "event_type",
    "organization_id",
    "processed_at"
  )
  VALUES (
    gen_random_uuid(),
    event_id,
    event_type,
    target_organization_id,
    now_ts
  )
  ON CONFLICT ("stripe_event_id") DO NOTHING
  RETURNING "id" INTO claimed_id;

  IF claimed_id IS NULL THEN
    RETURN false;
  END IF;

  -- Defense in depth: only apply events whose Stripe customer matches the
  -- customer this workspace created during checkout. The metadata
  -- organization id alone is never trusted as the tenant mapping.
  IF NOT EXISTS (
    SELECT 1
      FROM public."organization_subscriptions" AS os
     WHERE os."organization_id" = target_organization_id
       AND os."stripe_customer_id" = event_customer_id
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public."organization_subscriptions" (
    "id",
    "organization_id",
    "plan",
    "status",
    "stripe_subscription_id",
    "stripe_price_id",
    "current_period_end",
    "cancel_at_period_end",
    "created_at",
    "updated_at"
  )
  VALUES (
    gen_random_uuid(),
    target_organization_id,
    plan_value,
    status_value,
    subscription_id,
    price_id,
    period_end,
    cancel_at_period_end,
    now_ts,
    now_ts
  )
  ON CONFLICT ("organization_id") DO UPDATE SET
    "plan" = EXCLUDED."plan",
    "status" = EXCLUDED."status",
    "stripe_subscription_id" = EXCLUDED."stripe_subscription_id",
    "stripe_price_id" = EXCLUDED."stripe_price_id",
    "current_period_end" = EXCLUDED."current_period_end",
    "cancel_at_period_end" = EXCLUDED."cancel_at_period_end",
    "updated_at" = now_ts
  RETURNING "id" INTO entity_id;

  INSERT INTO public."audit_events" (
    "id",
    "organization_id",
    "actor_user_id",
    "action",
    "entity_type",
    "entity_id",
    "before",
    "after",
    "created_at"
  )
  VALUES (
    gen_random_uuid(),
    target_organization_id,
    NULL,
    'BILLING_SUBSCRIPTION_UPDATED',
    'OrganizationSubscription',
    entity_id,
    NULL,
    jsonb_build_object(
      'plan', plan_value,
      'status', status_value,
      'subscriptionId', subscription_id,
      'priceId', price_id
    ),
    now_ts
  );

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION stockpilot_sync_subscription(VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, VARCHAR, "Plan", "SubscriptionStatus", TIMESTAMPTZ, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stockpilot_sync_subscription(VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, VARCHAR, "Plan", "SubscriptionStatus", TIMESTAMPTZ, BOOLEAN) TO stockpilot_app;

