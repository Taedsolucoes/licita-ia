DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "opportunities"
    GROUP BY "tenant_id", "bidding_id"
    HAVING COUNT(*) > 1
    LIMIT 1
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Cannot add opportunity_tenant_bidding_key: duplicate tenant/bidding opportunities exist. Reconcile duplicate rows and linked participations before retrying.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "notifications"
    WHERE "opportunity_id" IS NOT NULL
    GROUP BY "tenant_id", "user_id", "opportunity_id", "channel", "template_code"
    HAVING COUNT(*) > 1
    LIMIT 1
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Cannot add notification_opportunity_delivery_key: duplicate opportunity deliveries exist. Reconcile notification history before retrying.';
  END IF;
END $$;

CREATE UNIQUE INDEX "opportunity_tenant_bidding_key"
  ON "opportunities" ("tenant_id", "bidding_id");

CREATE UNIQUE INDEX "notification_opportunity_delivery_key"
  ON "notifications" ("tenant_id", "user_id", "opportunity_id", "channel", "template_code");
