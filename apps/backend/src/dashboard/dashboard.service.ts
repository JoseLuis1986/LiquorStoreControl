import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toDecimal } from '../common/utils/decimal';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(tenantId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const [
      balances,
      salesToday,
      consumptionsToday,
      recentMovements,
      topSaleLines,
      products,
    ] = await Promise.all([
      this.prisma.inventoryBalance.findMany({
        where: { tenantId },
        include: { product: true, warehouse: true },
      }),
      this.prisma.sale.findMany({
        where: {
          tenantId,
          createdAt: { gte: start, lte: end },
          status: { in: ['PAID', 'PARTIAL', 'PENDING'] },
        },
        include: { lines: true, payments: true },
      }),
      this.prisma.consumption.findMany({
        where: { tenantId, createdAt: { gte: start, lte: end } },
        include: {
          customer: true,
          lines: { include: { product: true } },
        },
      }),
      this.prisma.inventoryMovement.findMany({
        where: { tenantId },
        include: { product: true, warehouse: true },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      this.prisma.saleLine.findMany({
        where: {
          sale: {
            tenantId,
            createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
            status: { in: ['PAID', 'PARTIAL', 'PENDING'] },
          },
        },
        include: { product: true },
      }),
      this.prisma.product.findMany({ where: { tenantId, active: true } }),
    ]);

    const stockValue = balances.reduce((acc, b) => {
      const qty = toDecimal(b.quantityBase);
      const price = toDecimal(b.product.defaultUnitPrice);
      return acc.add(qty.mul(price));
    }, toDecimal(0));

    const salesDayTotal = salesToday.reduce(
      (a, s) => a.add(s.totalAmount),
      toDecimal(0),
    );
    const salesDayPaid = salesToday.reduce(
      (a, s) => a.add(s.amountPaid),
      toDecimal(0),
    );

    const topMap = new Map<
      string,
      { productId: string; sku: string; name: string; qty: number; amount: number }
    >();
    for (const line of topSaleLines) {
      const key = line.productId;
      const cur = topMap.get(key) ?? {
        productId: key,
        sku: line.product.sku,
        name: line.product.name,
        qty: 0,
        amount: 0,
      };
      cur.qty += Number(line.quantityBase);
      cur.amount += Number(line.lineTotal);
      topMap.set(key, cur);
    }
    const topProducts = [...topMap.values()]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    const lowStock = balances
      .filter((b) => {
        const min = toDecimal(b.product.minStock);
        if (min.lte(0)) return false;
        return toDecimal(b.quantityBase).lte(min);
      })
      .map((b) => ({
        productId: b.productId,
        sku: b.product.sku,
        name: b.product.name,
        warehouse: b.warehouse.code,
        quantityBase: b.quantityBase,
        minStock: b.product.minStock,
      }));

    const customerConsumption = consumptionsToday.map((c) => ({
      id: c.id,
      customer: c.customer.name,
      lines: c.lines.map((l) => ({
        sku: l.product.sku,
        qty: l.quantityBase,
      })),
      at: c.createdAt,
    }));

    return {
      inventory: {
        skuCount: products.length,
        balanceLines: balances.length,
        stockValue: stockValue.toFixed(2),
      },
      salesToday: {
        count: salesToday.length,
        totalAmount: salesDayTotal.toFixed(2),
        amountPaid: salesDayPaid.toFixed(2),
      },
      topProducts,
      customerConsumptionToday: customerConsumption,
      lowStockAlerts: lowStock,
      recentMovements: recentMovements.map((m) => ({
        id: m.id,
        type: m.type,
        sku: m.product.sku,
        warehouse: m.warehouse.code,
        quantityBase: m.quantityBase,
        createdAt: m.createdAt,
        notes: m.notes,
      })),
    };
  }
}
