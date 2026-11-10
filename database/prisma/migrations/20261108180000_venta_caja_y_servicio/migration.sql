-- CreateEnum
CREATE TYPE "SaleFulfillment" AS ENUM ('TAKEAWAY', 'ON_PREMISE');

-- AlterTable sales
ALTER TABLE "sales" ADD COLUMN "fulfillment" "SaleFulfillment" NOT NULL DEFAULT 'TAKEAWAY';

-- AlterTable sale_lines
ALTER TABLE "sale_lines" ADD COLUMN "presentation_id" UUID;
ALTER TABLE "sale_lines" ADD COLUMN "presentation_qty" DECIMAL(18,6);

-- AlterTable customer_allocation_balances
ALTER TABLE "customer_allocation_balances" ADD COLUMN "quantity_prepaid" DECIMAL(18,6) NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_presentation_id_fkey" FOREIGN KEY ("presentation_id") REFERENCES "product_presentations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
