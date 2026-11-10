import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExchangeService } from '../exchange/exchange.service';

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exchange: ExchangeService,
  ) {}

  async saleHtml(tenantId: string, saleId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      include: {
        customer: {
          include: {
            cards: { where: { status: 'ACTIVE' }, select: { label: true, status: true } },
          },
        },
        warehouse: true,
        lines: { include: { product: true, presentation: true } },
        payments: true,
        tenant: true,
      },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    const rate = await this.exchange.current(tenantId);
    const due = Number(sale.totalAmount) - Number(sale.amountPaid);
    const money = (value: { toString(): string } | number) => {
      const usd = Number(value);
      const dollars = `$ ${usd.toFixed(2)}`;
      if (!(rate.usdToVes > 0)) return dollars;
      return `${dollars} · Bs ${(usd * rate.usdToVes).toFixed(2)}`;
    };
    const when = sale.createdAt.toLocaleString('es-VE', {
      timeZone: 'America/Caracas',
      dateStyle: 'short',
      timeStyle: 'short',
    });
    const onCard = sale.lines.filter((line) => line.fulfillment === 'ON_PREMISE');
    const card = sale.customer?.cards[0];
    const who = sale.customer
      ? `${esc(sale.customer.name)} · ${esc(sale.customer.code)}`
      : 'Mostrador';
    const rows = sale.lines
      .map((l) => {
        const qty = l.presentationQty
          ? `${l.presentationQty} ${l.presentation?.name ?? ''} (${l.quantityBase} u)`
          : `${l.quantityBase} u`;
        const entrega = l.fulfillment === 'ON_PREMISE' ? 'EN TARJETA' : 'ENTREGADO';
        return `<tr>
          <td>${esc(l.product.name)}<div class="sku">${esc(l.product.sku)}</div></td>
          <td class="r">${esc(qty)}</td>
          <td class="r">${money(l.lineTotal)}</td>
        </tr>
        <tr class="tag"><td colspan="3">${entrega}</td></tr>`;
      })
      .join('');
    const pays = sale.payments
      .map(
        (p) =>
          `<div class="row"><span>${payLabel(p.method)}</span><span>${money(p.amount)}</span></div>`,
      )
      .join('');
    const cardBlock =
      onCard.length && sale.customer
        ? `<div class="box">
            <div class="kicker">Queda en la tarjeta</div>
            <div><strong>${esc(sale.customer.name)}</strong></div>
            <div>Identificador ${esc(sale.customer.code)}</div>
            <div>${card ? 'Tarjeta activa' : 'Sin tarjeta activa'}${card?.label ? ` · ${esc(card.label)}` : ''}</div>
            <div class="pending">${onCard.map((l) => esc(l.product.name)).join(' · ')}</div>
          </div>`
        : '';
    return this.wrap(
      sale.tenant.name,
      `Comprobante ${sale.number ?? sale.id.slice(0, 8)}`,
      `
      <p class="meta">${esc(when)} · ${esc(sale.warehouse?.name ?? '')}</p>
      <p class="meta">Estado ${esc(sale.status)}</p>
      <p><strong>Cliente:</strong> ${who}</p>
      ${cardBlock}
      <table>
        <thead><tr><th>Producto</th><th class="r">Cant.</th><th class="r">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="row total"><span>Total</span><span>${money(sale.totalAmount)}</span></div>
      <p class="meta">Tasa ${rate.usdToVes > 0 ? `Bs ${rate.usdToVes.toFixed(4)} por dólar · ${esc(rate.source)}` : 'sin tasa cargada'}</p>
      <div class="row"><span>Pagado</span><span>${money(sale.amountPaid)}</span></div>
      <div class="row"><span>Saldo</span><span>${due.toFixed(2)}</span></div>
      <h3>Pagos</h3>
      ${pays || '<p>Sin pagos</p>'}
      `,
      true,
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

  private wrap(tenantName: string, title: string, body: string, ticket = false) {
    const sheet = ticket
      ? `
    body { font-family: "Segoe UI", sans-serif; margin: 0 auto; max-width: 320px; color: #1b1b1b; padding: 16px; }
    h1 { font-size: 1.15rem; text-align: center; margin: 8px 0 2px; letter-spacing: 0.04em; }
    h2 { font-size: 0.95rem; text-align: center; margin: 0 0 12px; font-weight: 600; }
    h3 { font-size: 0.85rem; margin: 14px 0 6px; text-transform: uppercase; letter-spacing: 0.06em; }
    .meta { margin: 0; font-size: 0.82rem; color: #444; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0 4px; }
    th, td { padding: 4px 0; text-align: left; font-size: 0.88rem; vertical-align: top; }
    th { border-bottom: 1px dashed #999; font-size: 0.75rem; text-transform: uppercase; }
    .sku { font-size: 0.72rem; color: #666; }
    tr.tag td { font-size: 0.72rem; letter-spacing: 0.04em; color: #333; padding-top: 0; border-bottom: 1px dashed #ccc; }
    .r { text-align: right; }
    .row { display: flex; justify-content: space-between; font-size: 0.9rem; margin: 2px 0; }
    .row.total { font-size: 1.05rem; font-weight: 700; margin-top: 8px; border-top: 1px solid #222; padding-top: 6px; }
    .box { border: 1px dashed #222; padding: 8px; margin: 10px 0; font-size: 0.88rem; }
    .kicker { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; }
    .pending { margin-top: 6px; }
    button { display: block; margin: 0 auto 12px; }
    @media print { button, .no-print { display: none; } body { padding: 0; } }
      `
      : `
    body { font-family: Georgia, "Times New Roman", serif; margin: 24px; color: #1b1b1b; }
    h1 { font-size: 1.4rem; margin: 0 0 4px; }
    h2 { font-size: 1.1rem; margin: 0 0 16px; font-weight: normal; color: #444; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; text-align: left; font-size: 0.95rem; }
    .r { text-align: right; }
    .totals { margin-top: 16px; font-size: 1.05rem; }
    @media print { .no-print { display: none; } body { margin: 12px; } }
      `;
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>${sheet}</style>
</head>
<body>
  <button class="no-print" onclick="window.print()">Imprimir</button>
  <h1>${esc(tenantName)}</h1>
  <h2>${esc(title)}</h2>
  ${body}
</body>
</html>`;
  }
}

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function payLabel(method: string) {
  if (method === 'CASH') return 'Efectivo';
  if (method === 'CARD') return 'Tarjeta';
  if (method === 'TRANSFER') return 'Transferencia';
  return method;
}
