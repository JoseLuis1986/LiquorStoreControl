import { Prisma } from '@prisma/client';
import { toDecimal } from './decimal';

type PriceClient = {
  customerPrice: {
    findUnique: (args: {
      where: {
        tenantId_customerId_productId: {
          tenantId: string;
          customerId: string;
          productId: string;
        };
      };
    }) => Promise<{ unitPrice: Prisma.Decimal } | null>;
  };
  product: {
    findUniqueOrThrow: (args: {
      where: { id: string };
    }) => Promise<{ defaultUnitPrice: Prisma.Decimal }>;
  };
};

export async function resolveUnitPrice(
  tx: PriceClient,
  tenantId: string,
  productId: string,
  customerId?: string | null,
): Promise<Prisma.Decimal> {
  if (customerId) {
    const custom = await tx.customerPrice.findUnique({
      where: {
        tenantId_customerId_productId: { tenantId, customerId, productId },
      },
    });
    if (custom) return toDecimal(custom.unitPrice);
  }
  const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
  return toDecimal(product.defaultUnitPrice);
}

export function saleStatusFromPaid(
  total: Prisma.Decimal,
  paid: Prisma.Decimal,
): 'PENDING' | 'PARTIAL' | 'PAID' {
  if (paid.lte(0)) return 'PENDING';
  if (paid.gte(total)) return 'PAID';
  return 'PARTIAL';
}
