import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toDecimal } from '../common/utils/decimal';
import * as ExcelJS from 'exceljs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async inventoryValued(tenantId: string) {
    const balances = await this.prisma.inventoryBalance.findMany({
      where: { tenantId },
      include: { product: true, warehouse: true },
      orderBy: [{ warehouse: { code: 'asc' } }, { product: { sku: 'asc' } }],
    });
    const rows = balances.map((b) => {
      const qty = Number(b.quantityBase);
      const unit = Number(b.product.defaultUnitPrice);
      return {
        warehouse: b.warehouse.code,
        sku: b.product.sku,
        name: b.product.name,
        quantityBase: qty,
        unitPrice: unit,
        value: qty * unit,
        minStock: Number(b.product.minStock),
      };
    });
    const totalValue = rows.reduce((a, r) => a + r.value, 0);
    return { rows, totalValue };
  }

  async topSellers(
    tenantId: string,
    from?: Date,
    to?: Date,
  ) {
    const lines = await this.prisma.saleLine.findMany({
      where: {
        sale: {
          tenantId,
          status: { in: ['PAID', 'PARTIAL', 'PENDING'] },
          ...(from || to
            ? {
                createdAt: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              }
            : {}),
        },
      },
      include: { product: true },
    });
    const map = new Map<
      string,
      { sku: string; name: string; qty: number; revenue: number }
    >();
    for (const l of lines) {
      const cur = map.get(l.productId) ?? {
        sku: l.product.sku,
        name: l.product.name,
        qty: 0,
        revenue: 0,
      };
      cur.qty += Number(l.quantityBase);
      cur.revenue += Number(l.lineTotal);
      map.set(l.productId, cur);
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty);
  }

  async consumptionByCustomer(
    tenantId: string,
    from?: Date,
    to?: Date,
    customerId?: string,
  ) {
    const consumptions = await this.prisma.consumption.findMany({
      where: {
        tenantId,
        ...(customerId ? { customerId } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      include: {
        customer: true,
        lines: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return consumptions.map((c) => ({
      id: c.id,
      date: c.createdAt,
      customerCode: c.customer.code,
      customerName: c.customer.name,
      lines: c.lines.map((l) => ({
        sku: l.product.sku,
        name: l.product.name,
        quantityBase: Number(l.quantityBase),
      })),
    }));
  }

  async purchasesBySupplier(tenantId: string, from?: Date, to?: Date) {
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        status: 'RECEIVED',
        ...(from || to
          ? {
              receivedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      include: {
        supplier: true,
        lines: { include: { product: true } },
      },
      orderBy: { receivedAt: 'desc' },
    });
    return orders.map((o) => ({
      number: o.number,
      supplier: o.supplier?.name ?? '—',
      supplierCode: o.supplier?.code ?? '—',
      receivedAt: o.receivedAt,
      totalAmount: Number(o.totalAmount),
      lines: o.lines.map((l) => ({
        sku: l.product.sku,
        qty: Number(l.quantityBase),
        unitCost: Number(l.unitCost),
        lineTotal: Number(l.lineTotal),
      })),
    }));
  }

  async profitability(tenantId: string, from?: Date, to?: Date) {
    const sales = await this.prisma.sale.findMany({
      where: {
        tenantId,
        status: { in: ['PAID', 'PARTIAL'] },
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      include: { lines: { include: { product: true } } },
    });
    let revenue = 0;
    let estimatedCogs = 0;
    for (const s of sales) {
      revenue += Number(s.amountPaid);
      for (const l of s.lines) {
        // COGS estimado: usa último unitCost de OC o 60% del precio si no hay
        estimatedCogs += Number(l.quantityBase) * Number(l.unitPrice) * 0.6;
      }
    }
    const purchases = await this.prisma.order.aggregate({
      where: {
        tenantId,
        status: 'RECEIVED',
        ...(from || to
          ? {
              receivedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      _sum: { totalAmount: true },
    });
    const purchaseCost = Number(purchases._sum.totalAmount ?? 0);
    return {
      revenue,
      estimatedCogs,
      purchaseCost,
      grossMarginEstimate: revenue - estimatedCogs,
      marginPct: revenue > 0 ? ((revenue - estimatedCogs) / revenue) * 100 : 0,
    };
  }

  async inventoryDifferences(tenantId: string) {
    // Compara saldo actual vs suma de movimientos (debe coincidir; reporta desvíos)
    const balances = await this.prisma.inventoryBalance.findMany({
      where: { tenantId },
      include: { product: true, warehouse: true },
    });
    const diffs = [];
    for (const b of balances) {
      const agg = await this.prisma.inventoryMovement.aggregate({
        where: {
          tenantId,
          warehouseId: b.warehouseId,
          productId: b.productId,
        },
        _sum: { quantityBase: true },
      });
      const fromMoves = Number(agg._sum.quantityBase ?? 0);
      const balance = Number(b.quantityBase);
      const delta = balance - fromMoves;
      if (Math.abs(delta) > 0.000001) {
        diffs.push({
          sku: b.product.sku,
          warehouse: b.warehouse.code,
          balance,
          fromMovements: fromMoves,
          difference: delta,
        });
      }
    }
    return { differences: diffs, ok: diffs.length === 0 };
  }

  async customerStatement(tenantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    const sales = await this.prisma.sale.findMany({
      where: { tenantId, customerId },
      include: { payments: true, lines: { include: { product: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const allocations = await this.prisma.customerAllocationBalance.findMany({
      where: { tenantId, customerId },
      include: { product: true, warehouse: true },
    });

    const openBalance = sales
      .filter((s) => s.status === 'PENDING' || s.status === 'PARTIAL')
      .reduce(
        (a, s) => a.add(toDecimal(s.totalAmount).sub(s.amountPaid)),
        toDecimal(0),
      );

    return {
      customer: {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        billingModes: customer.billingModes,
      },
      openReceivable: openBalance.toFixed(2),
      sales: sales.map((s) => ({
        id: s.id,
        number: s.number,
        date: s.createdAt,
        status: s.status,
        trigger: s.trigger,
        totalAmount: Number(s.totalAmount),
        amountPaid: Number(s.amountPaid),
        due: Number(s.totalAmount) - Number(s.amountPaid),
        payments: s.payments.map((p) => ({
          date: p.createdAt,
          method: p.method,
          amount: Number(p.amount),
        })),
      })),
      allocationBalances: allocations.map((a) => ({
        sku: a.product.sku,
        warehouse: a.warehouse.code,
        assigned: Number(a.quantityAssigned),
        consumed: Number(a.quantityConsumed),
        returned: Number(a.quantityReturned),
        remaining: Number(a.quantityBase),
      })),
    };
  }

  async toExcel(
    sheetName: string,
    columns: { header: string; key: string; width?: number }[],
    rows: Record<string, unknown>[],
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'LiquorControl';
    const sheet = wb.addWorksheet(sheetName);
    sheet.columns = columns;
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async toPdf(
    title: string,
    lines: string[],
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.font('Times-Bold').fontSize(16).text('LiquorControl', { continued: false });
      doc.font('Times-Roman').fontSize(12).text(title);
      doc.moveDown();
      doc.fontSize(10);
      for (const line of lines) {
        doc.text(line);
      }
      doc.end();
    });
  }
}
