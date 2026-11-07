import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toDecimal } from '../common/utils/decimal';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async lowStock(tenantId: string) {
    const balances = await this.prisma.inventoryBalance.findMany({
      where: { tenantId },
      include: { product: true, warehouse: true },
      orderBy: { updatedAt: 'desc' },
    });
    return balances
      .filter((b) => {
        const min = toDecimal(b.product.minStock);
        return min.gt(0) && toDecimal(b.quantityBase).lte(min);
      })
      .map((b) => ({
        severity: toDecimal(b.quantityBase).eq(0) ? 'critical' : 'warning',
        productId: b.productId,
        sku: b.product.sku,
        name: b.product.name,
        warehouseId: b.warehouseId,
        warehouseCode: b.warehouse.code,
        quantityBase: b.quantityBase.toString(),
        minStock: b.product.minStock.toString(),
        deficit: toDecimal(b.product.minStock)
          .sub(b.quantityBase)
          .toString(),
      }));
  }
}
