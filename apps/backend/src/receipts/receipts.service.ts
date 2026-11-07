import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  async saleHtml(tenantId: string, saleId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      include: {
        customer: true,
        warehouse: true,
        lines: { include: { product: true } },
        payments: true,
        tenant: true,
      },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    const due = Number(sale.totalAmount) - Number(sale.amountPaid);
    const rows = sale.lines
      .map(
        (l) =>
          `<tr><td>${l.product.sku}</td><td>${l.product.name}</td><td class="r">${l.quantityBase}</td><td class="r">${l.unitPrice}</td><td class="r">${l.lineTotal}</td></tr>`,
      )
      .join('');
    const pays = sale.payments
      .map(
        (p) =>
          `<tr><td>${p.createdAt.toISOString()}</td><td>${p.method}</td><td class="r">${p.amount}</td><td>${p.status}</td></tr>`,
      )
      .join('');
    return this.wrap(
      sale.tenant.name,
      `Comprobante de venta ${sale.number ?? sale.id.slice(0, 8)}`,
      `
      <p><strong>Cliente:</strong> ${sale.customer?.name ?? 'Mostrador'}</p>
      <p><strong>Estado:</strong> ${sale.status} · <strong>Trigger:</strong> ${sale.trigger}</p>
      <p><strong>Fecha:</strong> ${sale.createdAt.toISOString()}</p>
      <table>
        <thead><tr><th>SKU</th><th>Producto</th><th class="r">Cant.</th><th class="r">P.U.</th><th class="r">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="totals">Total: <strong>${sale.totalAmount} ${sale.currency}</strong> · Pagado: ${sale.amountPaid} · Saldo: ${due.toFixed(2)}</p>
      <h3>Pagos</h3>
      <table>
        <thead><tr><th>Fecha</th><th>Método</th><th class="r">Monto</th><th>Estado</th></tr></thead>
        <tbody>${pays || '<tr><td colspan="4">Sin pagos</td></tr>'}</tbody>
      </table>
      `,
    );
  }

  async paymentHtml(tenantId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, sale: { tenantId } },
      include: {
        sale: {
          include: { customer: true, tenant: true },
        },
      },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    return this.wrap(
      payment.sale.tenant.name,
      `Recibo de pago`,
      `
      <p><strong>Venta:</strong> ${payment.sale.number ?? payment.saleId}</p>
      <p><strong>Cliente:</strong> ${payment.sale.customer?.name ?? '—'}</p>
      <p><strong>Método:</strong> ${payment.method}</p>
      <p><strong>Monto:</strong> ${payment.amount} ${payment.sale.currency}</p>
      <p><strong>Fecha:</strong> ${payment.createdAt.toISOString()}</p>
      <p><strong>Notas:</strong> ${payment.notes ?? '—'}</p>
      `,
    );
  }

  async returnHtml(tenantId: string, returnId: string) {
    const ret = await this.prisma.stockReturn.findFirst({
      where: { id: returnId, tenantId },
      include: {
        customer: true,
        warehouse: true,
        lines: { include: { product: true } },
        tenant: true,
        sale: true,
      },
    });
    if (!ret) throw new NotFoundException('Devolución no encontrada');
    const rows = ret.lines
      .map(
        (l) =>
          `<tr><td>${l.product.sku}</td><td>${l.product.name}</td><td class="r">${l.quantityBase}</td><td class="r">${l.lineCredit}</td></tr>`,
      )
      .join('');
    return this.wrap(
      ret.tenant.name,
      `Comprobante de devolución ${ret.number}`,
      `
      <p><strong>Tipo:</strong> ${ret.type} · <strong>Cliente:</strong> ${ret.customer?.name ?? '—'}</p>
      <p><strong>Motivo:</strong> ${ret.reason ?? '—'}</p>
      <p><strong>Venta/Asignación:</strong> ${ret.sale?.number ?? ret.allocationId ?? '—'}</p>
      <table>
        <thead><tr><th>SKU</th><th>Producto</th><th class="r">Cant.</th><th class="r">Crédito</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="totals">Crédito total: <strong>${ret.totalCredit}</strong></p>
      `,
    );
  }

  private wrap(tenantName: string, title: string, body: string) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; margin: 24px; color: #1b1b1b; }
    h1 { font-size: 1.4rem; margin: 0 0 4px; }
    h2 { font-size: 1.1rem; margin: 0 0 16px; font-weight: normal; color: #444; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; text-align: left; font-size: 0.95rem; }
    .r { text-align: right; }
    .totals { margin-top: 16px; font-size: 1.05rem; }
    @media print { .no-print { display: none; } body { margin: 12px; } }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()">Imprimir</button>
  <h1>${tenantName}</h1>
  <h2>${title}</h2>
  ${body}
</body>
</html>`;
  }
}
