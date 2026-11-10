ALTER TABLE "sale_lines" ADD COLUMN "fulfillment" "SaleFulfillment" NOT NULL DEFAULT 'TAKEAWAY';

UPDATE "sale_lines" AS line
SET "fulfillment" = sale."fulfillment"
FROM "sales" AS sale
WHERE line."sale_id" = sale."id";
