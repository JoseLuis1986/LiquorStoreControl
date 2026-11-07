-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "products" ADD COLUMN "category_id" UUID;

-- AlterTable
ALTER TABLE "customer_allocation_balances" ADD COLUMN "quantity_assigned" DECIMAL(18,6) NOT NULL DEFAULT 0;
ALTER TABLE "customer_allocation_balances" ADD COLUMN "quantity_consumed" DECIMAL(18,6) NOT NULL DEFAULT 0;
ALTER TABLE "customer_allocation_balances" ADD COLUMN "quantity_returned" DECIMAL(18,6) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "categories_tenant_id_active_idx" ON "categories"("tenant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "categories_tenant_id_name_key" ON "categories"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "products_tenant_id_category_id_idx" ON "products"("tenant_id", "category_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
