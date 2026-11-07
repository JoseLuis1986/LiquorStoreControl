import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  PaymentMethod,
  Prisma,
  SaleTrigger,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { toDecimal } from '../common/utils/decimal';
import { resolveUnitPrice, saleStatusFromPaid } from '../common/utils/pricing';
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
        customer: true,
        warehouse: true,
        lines: { include: { product: true } },
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
        customer: true,
        warehouse: true,
        lines: { include: { product: true } },
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
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
      }[] = [];

      for (const line of dto.lines) {
        const qty = toDecimal(line.quantityBase);
        const unitPrice =
          line.unitPrice != null
            ? toDecimal(line.unitPrice)
            : await resolveUnitPrice(tx, tenantId, line.productId, dto.customerId);
        lineData.push({
          productId: line.productId,
          quantityBase: qty,
          unitPrice,
          lineTotal: qty.mul(unitPrice),
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

    return this.get(tenantId, sale);
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
    return this.get(tenantId, saleId);
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
}
