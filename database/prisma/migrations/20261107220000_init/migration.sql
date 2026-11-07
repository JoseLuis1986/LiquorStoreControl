-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('ACTIVE', 'REVOKED', 'LOST', 'EXPIRED');

-- CreateEnum
CREATE TYPE "UnitKind" AS ENUM ('COUNT', 'VOLUME', 'WEIGHT', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductModality" AS ENUM ('UNIT', 'CASE', 'BULK');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('PURCHASE_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'ALLOCATION_OUT', 'ALLOCATION_REVERSAL', 'SALE_OUT', 'SALE_REVERSAL', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('COMPLETED', 'REVERSED');

-- CreateEnum
CREATE TYPE "SaleTrigger" AS ENUM ('ALLOCATION', 'CONSUMPTION', 'MANUAL');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('PENDING', 'PAID', 'PARTIAL', 'CANCELLED', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "customer_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "billing_modes" JSONB NOT NULL DEFAULT '["CHARGE_ON_ALLOCATION"]',
    "email" TEXT,
    "phone" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "label" TEXT,
    "status" "CardStatus" NOT NULL DEFAULT 'ACTIVE',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "UnitKind" NOT NULL DEFAULT 'COUNT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "base_unit_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modality" "ProductModality" NOT NULL DEFAULT 'UNIT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_presentations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "factor_to_base" DECIMAL(18,6) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "barcode" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_presentations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity_base" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantity_base" DECIMAL(18,6) NOT NULL,
    "reverses_movement_id" UUID,
    "reference_id" UUID,
    "reference_type" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity_base" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_lines" (
    "id" UUID NOT NULL,
    "allocation_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "presentation_id" UUID,
    "quantity_base" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "allocation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_allocation_balances" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity_base" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_allocation_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumption_lines" (
    "id" UUID NOT NULL,
    "consumption_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity_base" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "consumption_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID,
    "trigger" "SaleTrigger" NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'PENDING',
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "reference_id" UUID,
    "reference_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_lines" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity_base" DECIMAL(18,6) NOT NULL,
    "unit_price" DECIMAL(18,2) NOT NULL,
    "line_total" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "sale_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "users_tenant_id_role_idx" ON "users"("tenant_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "customers_tenant_id_status_idx" ON "customers"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_code_key" ON "customers"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "cards_token_hash_key" ON "cards"("token_hash");

-- CreateIndex
CREATE INDEX "cards_tenant_id_customer_id_idx" ON "cards"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "cards_tenant_id_status_idx" ON "cards"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_tenant_id_code_key" ON "units_of_measure"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "products_tenant_id_active_idx" ON "products"("tenant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_sku_key" ON "products"("tenant_id", "sku");

-- CreateIndex
CREATE INDEX "product_presentations_tenant_id_product_id_idx" ON "product_presentations"("tenant_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_presentations_tenant_id_product_id_name_key" ON "product_presentations"("tenant_id", "product_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_tenant_id_code_key" ON "warehouses"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_tenant_id_warehouse_id_product_id_key" ON "inventory_balances"("tenant_id", "warehouse_id", "product_id");

-- CreateIndex
CREATE INDEX "inventory_movements_tenant_id_warehouse_id_product_id_creat_idx" ON "inventory_movements"("tenant_id", "warehouse_id", "product_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_tenant_id_reference_type_reference_id_idx" ON "inventory_movements"("tenant_id", "reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "orders_tenant_id_status_idx" ON "orders"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tenant_id_number_key" ON "orders"("tenant_id", "number");

-- CreateIndex
CREATE INDEX "order_lines_order_id_idx" ON "order_lines"("order_id");

-- CreateIndex
CREATE INDEX "allocations_tenant_id_customer_id_created_at_idx" ON "allocations"("tenant_id", "customer_id", "created_at");

-- CreateIndex
CREATE INDEX "allocation_lines_allocation_id_idx" ON "allocation_lines"("allocation_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_allocation_balances_tenant_id_customer_id_warehous_key" ON "customer_allocation_balances"("tenant_id", "customer_id", "warehouse_id", "product_id");

-- CreateIndex
CREATE INDEX "consumptions_tenant_id_customer_id_created_at_idx" ON "consumptions"("tenant_id", "customer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "consumptions_tenant_id_idempotency_key_key" ON "consumptions"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "consumption_lines_consumption_id_idx" ON "consumption_lines"("consumption_id");

-- CreateIndex
CREATE INDEX "sales_tenant_id_status_created_at_idx" ON "sales"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "sales_tenant_id_reference_type_reference_id_idx" ON "sales"("tenant_id", "reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "sale_lines_sale_id_idx" ON "sale_lines"("sale_id");

-- CreateIndex
CREATE INDEX "payments_sale_id_idx" ON "payments"("sale_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_base_unit_id_fkey" FOREIGN KEY ("base_unit_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_presentations" ADD CONSTRAINT "product_presentations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_presentations" ADD CONSTRAINT "product_presentations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_presentations" ADD CONSTRAINT "product_presentations_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_reverses_movement_id_fkey" FOREIGN KEY ("reverses_movement_id") REFERENCES "inventory_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_lines" ADD CONSTRAINT "allocation_lines_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "allocations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_lines" ADD CONSTRAINT "allocation_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_lines" ADD CONSTRAINT "allocation_lines_presentation_id_fkey" FOREIGN KEY ("presentation_id") REFERENCES "product_presentations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_allocation_balances" ADD CONSTRAINT "customer_allocation_balances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_allocation_balances" ADD CONSTRAINT "customer_allocation_balances_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_allocation_balances" ADD CONSTRAINT "customer_allocation_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_allocation_balances" ADD CONSTRAINT "customer_allocation_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumptions" ADD CONSTRAINT "consumptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumptions" ADD CONSTRAINT "consumptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumptions" ADD CONSTRAINT "consumptions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumptions" ADD CONSTRAINT "consumptions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_lines" ADD CONSTRAINT "consumption_lines_consumption_id_fkey" FOREIGN KEY ("consumption_id") REFERENCES "consumptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_lines" ADD CONSTRAINT "consumption_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

