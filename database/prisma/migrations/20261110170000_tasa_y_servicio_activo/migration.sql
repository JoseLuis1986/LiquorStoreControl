CREATE TYPE "ExchangeRateMode" AS ENUM ('MANUAL', 'AUTOMATIC');

CREATE TABLE "exchange_rate_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mode" "ExchangeRateMode" NOT NULL DEFAULT 'AUTOMATIC',
    "usd_to_ves" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'BCV',
    "fetched_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rate_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exchange_rate_settings_tenant_id_key" ON "exchange_rate_settings"("tenant_id");

ALTER TABLE "exchange_rate_settings"
ADD CONSTRAINT "exchange_rate_settings_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "service_visits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_visits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_visits_tenant_id_created_at_idx" ON "service_visits"("tenant_id", "created_at");
CREATE INDEX "service_visits_tenant_id_customer_id_created_at_idx" ON "service_visits"("tenant_id", "customer_id", "created_at");

ALTER TABLE "service_visits"
ADD CONSTRAINT "service_visits_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_visits"
ADD CONSTRAINT "service_visits_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_visits"
ADD CONSTRAINT "service_visits_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales" ALTER COLUMN "currency" SET DEFAULT 'USD';
UPDATE "sales" SET "currency" = 'USD' WHERE "currency" = 'MXN';
