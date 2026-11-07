import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toDecimal } from '../common/utils/decimal';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private range(days: number) {
    const end = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    return { start, end };
  }

  private dayKey(d: Date) {
    return d.toISOString().slice(0, 10);
  }

  async trends(
    tenantId: string,
    opts: { days?: number; warehouseId?: string; branchId?: string } = {},
  ) {
    const days = Math.min(Math.max(opts.days ?? 14, 1), 90);
    const { start, end } = this.range(days);

    let warehouseIds: string[] | undefined;
    if (opts.warehouseId) {
      warehouseIds = [opts.warehouseId];
    } else if (opts.branchId) {
      const wh = await this.prisma.warehouse.findMany({
        where: { tenantId, branchId: opts.branchId, active: true },
        select: { id: true },
      });
      warehouseIds = wh.map((w) => w.id);
    }

    const whFilter = warehouseIds
      ? { warehouseId: { in: warehouseIds } }
      : {};

    const [sales, consumptions, balances, products] = await Promise.all([
      this.prisma.sale.findMany({
        where: {
          tenantId,
          createdAt: { gte: start, lte: end },
          status: { in: ['PAID', 'PARTIAL', 'PENDING'] },
          ...whFilter,
        },
        include: { lines: true },
      }),
      this.prisma.consumption.findMany({
        where: {
          tenantId,
          createdAt: { gte: start, lte: end },
          ...whFilter,
        },
        include: { lines: true },
      }),
      this.prisma.inventoryBalance.findMany({
        where: { tenantId, ...whFilter },
        include: { product: true },
      }),
      this.prisma.product.findMany({ where: { tenantId, active: true } }),
    ]);

    const buckets: Record<
      string,
      { date: string; salesAmount: number; salesCount: number; consumptionQty: number }
    > = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = this.dayKey(d);
      buckets[key] = {
        date: key,
        salesAmount: 0,
        salesCount: 0,
        consumptionQty: 0,
      };
    }

    for (const s of sales) {
      const key = this.dayKey(s.createdAt);
      if (!buckets[key]) continue;
      buckets[key].salesCount += 1;
      buckets[key].salesAmount += Number(toDecimal(s.totalAmount));
    }
    for (const c of consumptions) {
      const key = this.dayKey(c.createdAt);
      if (!buckets[key]) continue;
      const qty = c.lines.reduce(
        (a, l) => a + Number(toDecimal(l.quantityBase)),
        0,
      );
      buckets[key].consumptionQty += qty;
    }

    const soldMap = new Map<string, number>();
    for (const s of sales) {
      for (const l of s.lines) {
        soldMap.set(
          l.productId,
          (soldMap.get(l.productId) ?? 0) + Number(toDecimal(l.quantityBase)),
        );
      }
    }

    const rotation = products
      .map((p) => {
        const stock = balances
          .filter((b) => b.productId === p.id)
          .reduce((a, b) => a + Number(toDecimal(b.quantityBase)), 0);
        const sold = soldMap.get(p.id) ?? 0;
        const avgStock = stock + sold / 2;
        const turns = avgStock > 0 ? sold / avgStock : sold > 0 ? sold : 0;
        return {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          soldQty: sold,
          stockQty: stock,
          turns: Number(turns.toFixed(3)),
        };
      })
      .filter((r) => r.soldQty > 0 || r.stockQty > 0)
      .sort((a, b) => b.turns - a.turns)
      .slice(0, 20);

    return {
      days,
      from: start.toISOString(),
      to: end.toISOString(),
      series: Object.values(buckets),
      rotation,
      totals: {
        salesAmount: Object.values(buckets).reduce((a, b) => a + b.salesAmount, 0),
        salesCount: Object.values(buckets).reduce((a, b) => a + b.salesCount, 0),
        consumptionQty: Object.values(buckets).reduce(
          (a, b) => a + b.consumptionQty,
          0,
        ),
      },
    };
  }
}
