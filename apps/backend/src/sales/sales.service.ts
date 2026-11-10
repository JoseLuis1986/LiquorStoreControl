import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  PaymentMethod,
  Prisma,
  SaleFulfillment,
  SaleTrigger,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { toDecimal } from '../common/utils/decimal';
import { resolveUnitPrice, saleStatusFromPaid } from '../common/utils/pricing';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CreateManualSaleDto,
  RecordPaymentDto,
  SetCustomerPriceDto,
} from './dto/sale.dto';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly realtime: RealtimeService,
  ) {}

  list(tenantId: string, opts: { status?: string; arOnly?: boolean } = {}) {
    return this.prisma.sale.findMany({
      where: {
        tenantId,
        ...(opts.status ? { status: opts.status as never } : {}),
        ...(opts.arOnly
          ? { status: { in: ['PENDING', 'PARTIAL'] } }
          : {}),
      },
      include: {
        customer: {
          include: {
            cards: {
              where: { status: 'ACTIVE' },
              select: { id: true, label: true, status: true },
            },
          },
        },
        warehouse: true,
        lines: { include: { product: true, presentation: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async get(tenantId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: {
        customer: {
          include: {
            cards: {
              where: { status: 'ACTIVE' },
              select: { id: true, label: true, status: true },
            },
          },
        },
        warehouse: true,
        lines: { include: { product: true, presentation: true } },
        payments: true,
        cashSession: true,
      },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    return {
      ...sale,
      amountDue: toDecimal(sale.totalAmount).sub(sale.amountPaid),
    };
  }

  /**
   * Crea venta con precios (lista cliente o default) y opcionalmente descuenta
   * inventario si es venta MANUAL de mostrador (SALE_OUT).
   */
  async createManual(tenantId: string, userId: string, dto: CreateManualSaleDto) {
    const trigger = dto.trigger ?? SaleTrigger.MANUAL;
    const deductStock = trigger === SaleTrigger.MANUAL;

    const resolvedLines: {
      productId: string;
      quantityBase: Prisma.Decimal;
      presentationId: string | null;
      presentationQty: Prisma.Decimal | null;
      unitPriceOverride: Prisma.Decimal | null;
      fulfillment: SaleFulfillment;
    }[] = [];

    for (const line of dto.lines) {
      const product = await this.prisma.product.findFirst({
        where: { id: line.productId, tenantId, active: true },
      });
      if (!product) {
        throw new NotFoundException(`Producto ${line.productId} no encontrado`);
      }

      let quantityBase: Prisma.Decimal;
      let presentationId: string | null = null;
      let presentationQty: Prisma.Decimal | null = null;
      if (line.presentationId) {
        const presentation = await this.prisma.productPresentation.findFirst({
          where: {
            id: line.presentationId,
            tenantId,
            productId: line.productId,
          },
        });
        if (!presentation) throw new NotFoundException('Presentación no encontrada');
        const count = line.quantity ?? line.quantityBase;
        if (count == null) {
          throw new BadRequestException('Indica cuántas presentaciones se venden');
        }
        presentationId = presentation.id;
        presentationQty = toDecimal(count);
        quantityBase = presentationQty.mul(presentation.factorToBase);
      } else if (line.quantityBase != null) {
        quantityBase = toDecimal(line.quantityBase);
      } else if (line.quantity != null) {
        quantityBase = toDecimal(line.quantity);
      } else {
        throw new BadRequestException('Indica la cantidad');
      }

      const lineFulfillment =
        line.fulfillment === 'ON_PREMISE' ||
        (line.fulfillment == null && dto.fulfillment === 'ON_PREMISE')
          ? SaleFulfillment.ON_PREMISE
          : SaleFulfillment.TAKEAWAY;
      resolvedLines.push({
        productId: line.productId,
        quantityBase,
        presentationId,
        presentationQty,
        unitPriceOverride:
          line.unitPrice != null ? toDecimal(line.unitPrice) : null,
        fulfillment: lineFulfillment,
      });
    }

    const fulfillment = resolvedLines.some(
      (line) => line.fulfillment === SaleFulfillment.ON_PREMISE,
    )
      ? SaleFulfillment.ON_PREMISE
      : SaleFulfillment.TAKEAWAY;

    if (fulfillment === SaleFulfillment.ON_PREMISE && !dto.customerId) {
      throw new BadRequestException(
        'Para consumir en el local elige la mesa o el cliente de la tarjeta',
      );
    }
    if (fulfillment === SaleFulfillment.ON_PREMISE && dto.customerId) {
      const card = await this.prisma.card.findFirst({
        where: { tenantId, customerId: dto.customerId, status: 'ACTIVE' },
      });
      if (!card) {
        throw new BadRequestException(
          'Ese cliente no tiene tarjeta activa. El dueño debe emitirla e imprimir el QR.',
        );
      }
    }

    let cashSessionId = dto.cashSessionId;
    if (!cashSessionId) {
      const open = await this.prisma.cashSession.findFirst({
        where: {
          tenantId,
          warehouseId: dto.warehouseId,
          status: 'OPEN',
        },
      });
      cashSessionId = open?.id;
    }

    const sale = await this.prisma.$transaction(async (tx) => {
      const lineData: {
        productId: string;
        quantityBase: Prisma.Decimal;
        presentationId: string | null;
        presentationQty: Prisma.Decimal | null;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        fulfillment: SaleFulfillment;
      }[] = [];

      for (const line of resolvedLines) {
        const unitPrice =
          line.unitPriceOverride ??
          (await resolveUnitPrice(tx, tenantId, line.productId, dto.customerId));
        lineData.push({
          productId: line.productId,
          quantityBase: line.quantityBase,
          presentationId: line.presentationId,
          presentationQty: line.presentationQty,
          unitPrice,
          lineTotal: line.quantityBase.mul(unitPrice),
          fulfillment: line.fulfillment,
        });
      }

      const totalAmount = lineData.reduce(
        (a, l) => a.add(l.lineTotal),
        toDecimal(0),
      );
      const number = `V-${Date.now().toString(36).toUpperCase()}`;

      const created = await tx.sale.create({
        data: {
          tenantId,
          customerId: dto.customerId,
          warehouseId: dto.warehouseId,
          cashSessionId,
          number,
          trigger,
          fulfillment,
          status: 'PENDING',
          totalAmount,
          amountPaid: toDecimal(0),
          lines: { create: lineData },
        },
        include: {
          lines: { include: { product: true } },
          customer: true,
          warehouse: true,
        },
      });

      if (deductStock) {
        for (const line of lineData) {
          await this.inventory.applyDelta(tenantId, userId, {
            warehouseId: dto.warehouseId,
            productId: line.productId,
            delta: line.quantityBase.neg(),
            type: InventoryMovementType.SALE_OUT,
            referenceType: 'SALE',
            referenceId: created.id,
            notes: `Venta ${number}`,
            tx,
          });
        }
      }

      if (dto.customerId) {
        for (const line of lineData.filter(
          (item) => item.fulfillment === SaleFulfillment.ON_PREMISE,
        )) {
          await tx.customerAllocationBalance.upsert({
            where: {
              tenantId_customerId_warehouseId_productId: {
                tenantId,
                customerId: dto.customerId,
                warehouseId: dto.warehouseId,
                productId: line.productId,
              },
            },
            create: {
              tenantId,
              customerId: dto.customerId,
              warehouseId: dto.warehouseId,
              productId: line.productId,
              quantityBase: line.quantityBase,
              quantityAssigned: line.quantityBase,
              quantityConsumed: toDecimal(0),
              quantityReturned: toDecimal(0),
              quantityPrepaid: line.quantityBase,
            },
            update: {
              quantityBase: { increment: line.quantityBase },
              quantityAssigned: { increment: line.quantityBase },
              quantityPrepaid: { increment: line.quantityBase },
            },
          });
        }
      }

      if (dto.paymentMethod && dto.paymentAmount != null) {
        await this.applyPaymentTx(tx, {
          tenantId,
          userId,
          saleId: created.id,
          method: dto.paymentMethod,
          amount: toDecimal(dto.paymentAmount),
          cashSessionId,
        });
      }

      return created.id;
    });

    const result = await this.get(tenantId, sale);
    this.realtime.emitToTenant(tenantId, 'sale.created', {
      id: result.id,
      number: result.number,
      warehouseId: result.warehouseId,
      totalAmount: result.totalAmount.toString(),
      status: result.status,
    });
    if (deductStock) {
      this.realtime.emitToTenant(tenantId, 'inventory.changed', {
        reason: 'sale',
        saleId: result.id,
      });
      await this.emitLowStockIfNeeded(tenantId, dto.warehouseId);
    }
    return result;
  }

  async recordPayment(
    tenantId: string,
    userId: string,
    saleId: string,
    dto: RecordPaymentDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await this.applyPaymentTx(tx, {
        tenantId,
        userId,
        saleId,
        method: dto.method,
        amount: toDecimal(dto.amount),
        cashSessionId: dto.cashSessionId,
        notes: dto.notes,
      });
    });
    const updated = await this.get(tenantId, saleId);
    this.realtime.emitToTenant(tenantId, 'sale.payment', {
      id: updated.id,
      number: updated.number,
      status: updated.status,
      amountPaid: updated.amountPaid.toString(),
    });
    return updated;
  }

  private async applyPaymentTx(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      userId: string;
      saleId: string;
      method: PaymentMethod;
      amount: Prisma.Decimal;
      cashSessionId?: string | null;
      notes?: string;
    },
  ) {
    const sale = await tx.sale.findFirst({
      where: { id: args.saleId, tenantId: args.tenantId },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    if (sale.status === 'CANCELLED' || sale.status === 'VOID') {
      throw new BadRequestException('Venta no admite pagos');
    }
    if (args.amount.lte(0)) {
      throw new BadRequestException('Monto de pago inválido');
    }

    let cashSessionId = args.cashSessionId;
    if (!cashSessionId && sale.warehouseId) {
      const open = await tx.cashSession.findFirst({
        where: {
          tenantId: args.tenantId,
          warehouseId: sale.warehouseId,
          status: 'OPEN',
        },
      });
      cashSessionId = open?.id;
    }

    await tx.payment.create({
      data: {
        saleId: sale.id,
        method: args.method,
        amount: args.amount,
        status: 'COMPLETED',
        cashSessionId: cashSessionId ?? undefined,
        recordedByUserId: args.userId,
        notes: args.notes,
      },
    });

    const amountPaid = toDecimal(sale.amountPaid).add(args.amount);
    const status = saleStatusFromPaid(toDecimal(sale.totalAmount), amountPaid);
    await tx.sale.update({
      where: { id: sale.id },
      data: { amountPaid, status },
    });
  }

  /** Usado por allocation/consumption para crear cargos con precio real. */
  async createChargeFromLines(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      customerId: string;
      warehouseId?: string;
      trigger: SaleTrigger;
      referenceType: string;
      referenceId: string;
      lines: { productId: string; quantityBase: Prisma.Decimal }[];
      cashSessionId?: string | null;
    },
  ) {
    const lineData = [];
    for (const line of args.lines) {
      const unitPrice = await resolveUnitPrice(
        tx,
        args.tenantId,
        line.productId,
        args.customerId,
      );
      lineData.push({
        productId: line.productId,
        quantityBase: line.quantityBase,
        unitPrice,
        lineTotal: line.quantityBase.mul(unitPrice),
      });
    }
    const totalAmount = lineData.reduce(
      (a, l) => a.add(l.lineTotal),
      toDecimal(0),
    );
    const number = `C-${Date.now().toString(36).toUpperCase()}`;
    return tx.sale.create({
      data: {
        tenantId: args.tenantId,
        customerId: args.customerId,
        warehouseId: args.warehouseId,
        cashSessionId: args.cashSessionId ?? undefined,
        number,
        trigger: args.trigger,
        status: 'PENDING',
        totalAmount,
        amountPaid: toDecimal(0),
        referenceType: args.referenceType,
        referenceId: args.referenceId,
        lines: { create: lineData },
      },
    });
  }

  setCustomerPrice(tenantId: string, dto: SetCustomerPriceDto) {
    return this.prisma.customerPrice.upsert({
      where: {
        tenantId_customerId_productId: {
          tenantId,
          customerId: dto.customerId,
          productId: dto.productId,
        },
      },
      create: {
        tenantId,
        customerId: dto.customerId,
        productId: dto.productId,
        unitPrice: toDecimal(dto.unitPrice),
      },
      update: { unitPrice: toDecimal(dto.unitPrice) },
    });
  }

  listCustomerPrices(tenantId: string, customerId?: string) {
    return this.prisma.customerPrice.findMany({
      where: {
        tenantId,
        ...(customerId ? { customerId } : {}),
      },
      include: { product: true, customer: true },
    });
  }

  private async emitLowStockIfNeeded(tenantId: string, warehouseId: string) {
    const balances = await this.prisma.inventoryBalance.findMany({
      where: { tenantId, warehouseId },
      include: { product: true, warehouse: true },
    });
    const alerts = balances
      .filter((b) => {
        const min = toDecimal(b.product.minStock);
        return min.gt(0) && toDecimal(b.quantityBase).lte(min);
      })
      .map((b) => ({
        productId: b.productId,
        sku: b.product.sku,
        name: b.product.name,
        warehouseId: b.warehouseId,
        warehouseCode: b.warehouse.code,
        quantityBase: b.quantityBase.toString(),
        minStock: b.product.minStock.toString(),
      }));
    if (alerts.length) {
      this.realtime.emitToTenant(tenantId, 'stock.low', { alerts });
    }
  }
}
