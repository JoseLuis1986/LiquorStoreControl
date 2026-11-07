-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "ReturnType" AS ENUM ('ALLOCATION', 'SALE');
CREATE TYPE "ReturnStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- AlterTable products
ALTER TABLE "products" ADD COLUMN "default_unit_price" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable order_lines
ALTER TABLE "order_lines" ADD COLUMN "unit_cost" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "order_lines" ADD COLUMN "line_total" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable orders
ALTER TABLE "orders" ADD COLUMN "supplier_id" UUID;
ALTER TABLE "orders" ADD COLUMN "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "received_at" TIMESTAMP(3);

-- AlterTable sales
ALTER TABLE "sales" ADD COLUMN "warehouse_id" UUID;
ALTER TABLE "sales" ADD COLUMN "cash_session_id" UUID;
ALTER TABLE "sales" ADD COLUMN "number" TEXT;
ALTER TABLE "sales" ADD COLUMN "amount_paid" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable payments
ALTER TABLE "payments" ADD COLUMN "cash_session_id" UUID;
ALTER TABLE "payments" ADD COLUMN "recorded_by_user_id" UUID;
ALTER TABLE "payments" ADD COLUMN "notes" TEXT;
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'COMPLETED';

-- CreateTable suppliers
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "tax_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_prices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "unit_price" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_prices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cash_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "opened_by_user_id" UUID NOT NULL,
    "closed_by_user_id" UUID,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "opening_float" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "closing_amount" DECIMAL(18,2),
    "expected_cash" DECIMAL(18,2),
    "notes" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "returns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "customer_id" UUID,
    "sale_id" UUID,
    "allocation_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "type" "ReturnType" NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'COMPLETED',
    "number" TEXT NOT NULL,
    "reason" TEXT,
    "total_credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "return_lines" (
    "id" UUID NOT NULL,
    "return_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity_base" DECIMAL(18,6) NOT NULL,
    "unit_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "line_credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    CONSTRAINT "return_lines_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "suppliers_tenant_id_code_key" ON "suppliers"("tenant_id", "code");
CREATE INDEX "suppliers_tenant_id_active_idx" ON "suppliers"("tenant_id", "active");
CREATE UNIQUE INDEX "customer_prices_tenant_id_customer_id_product_id_key" ON "customer_prices"("tenant_id", "customer_id", "product_id");
CREATE INDEX "cash_sessions_tenant_id_status_opened_at_idx" ON "cash_sessions"("tenant_id", "status", "opened_at");
CREATE UNIQUE INDEX "sales_tenant_id_number_key" ON "sales"("tenant_id", "number");
CREATE INDEX "payments_cash_session_id_idx" ON "payments"("cash_session_id");
CREATE UNIQUE INDEX "returns_tenant_id_number_key" ON "returns"("tenant_id", "number");
CREATE INDEX "returns_tenant_id_created_at_idx" ON "returns"("tenant_id", "created_at");
CREATE INDEX "return_lines_return_id_idx" ON "return_lines"("return_id");

-- FKs
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_opened_by_user_id_fkey" FOREIGN KEY ("opened_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_lines" ADD CONSTRAINT "return_lines_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_lines" ADD CONSTRAINT "return_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
