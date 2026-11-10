import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SaleTrigger } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toDecimal } from '../common/utils/decimal';
import { resolveUnitPrice } from '../common/utils/pricing';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateConsumptionDto } from './dto/consumption.dto';

@Injectable()
export class ConsumptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  list(
    tenantId: string,
    opts: { customerId?: string; take?: number } = {},
  ) {
    return this.prisma.consumption.findMany({
      where: {
        tenantId,
        ...(opts.customerId ? { customerId: opts.customerId } : {}),
      },
      include: {
        customer: true,
        warehouse: true,
        lines: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: opts.take ?? 100,
    });
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateConsumptionDto,
    idempotencyKey: string,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key es obligatorio');
    }

    const existing = await this.prisma.consumption.findUnique({
      where: {
        tenantId_idempotencyKey: { tenantId, idempotencyKey },
      },
      include: {
        customer: true,
        warehouse: true,
        lines: { include: { product: true } },
      },
    });
    if (existing) {
      // Replay idempotente: misma key → mismo resultado
      this.assertPayloadMatch(existing, dto);
      return { replay: true, consumption: existing };
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, tenantId },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    if (customer.status !== 'ACTIVE') {
      throw new BadRequestException('Cliente inactivo o bloqueado');
    }

    // Verificar tarjeta activa del cliente (operación POS requiere tarjeta vigente)
    const activeCard = await this.prisma.card.findFirst({
      where: { tenantId, customerId: customer.id, status: 'ACTIVE' },
    });
    if (!activeCard) {
      throw new BadRequestException('Cliente sin tarjeta activa');
    }

    try {
      const consumption = await this.prisma.$transaction(async (tx) => {
        const created = await tx.consumption.create({
          data: {
            tenantId,
            customerId: dto.customerId,
            warehouseId: dto.warehouseId,
            createdByUserId: userId,
            idempotencyKey,
            notes: dto.notes,
            lines: {
              create: dto.lines.map((l) => ({
                productId: l.productId,
                quantityBase: toDecimal(l.quantityBase),
              })),
            },
          },
          include: {
            lines: { include: { product: true } },
            customer: true,
            warehouse: true,
          },
        });

        const billable: { productId: string; quantityBase: Prisma.Decimal }[] = [];
        for (const line of dto.lines) {
          const qty = toDecimal(line.quantityBase);
          const bal = await tx.customerAllocationBalance.findUnique({
            where: {
              tenantId_customerId_warehouseId_productId: {
                tenantId,
                customerId: dto.customerId,
                warehouseId: dto.warehouseId,
                productId: line.productId,
              },
            },
          });
          if (!bal || toDecimal(bal.quantityBase).lt(qty)) {
            throw new ConflictException(
              'No quedan suficientes unidades asignadas. Otro despacho ya las tomó.',
            );
          }
          const prepaid = toDecimal(bal.quantityPrepaid);
          const fromPrepaid = prepaid.gte(qty) ? qty : prepaid;
          const chargeQty = qty.sub(fromPrepaid);
          await tx.customerAllocationBalance.update({
            where: { id: bal.id },
            data: {
              quantityBase: { decrement: qty },
              quantityConsumed: { increment: qty },
              quantityPrepaid: { decrement: fromPrepaid },
            },
          });
          if (chargeQty.gt(0)) {
            billable.push({ productId: line.productId, quantityBase: chargeQty });
          }
        }

        const modes = (customer.billingModes as string[]) ?? [];
        if (modes.includes('CHARGE_ON_CONSUMPTION') && billable.length > 0) {
          const saleLines = [];
          for (const l of billable) {
            const unitPrice = await resolveUnitPrice(
              tx,
              tenantId,
              l.productId,
              customer.id,
            );
            saleLines.push({
              productId: l.productId,
              quantityBase: l.quantityBase,
              unitPrice,
              lineTotal: l.quantityBase.mul(unitPrice),
            });
          }
          const totalAmount = saleLines.reduce(
            (a, l) => a.add(l.lineTotal),
            toDecimal(0),
          );
          const openCash = await tx.cashSession.findFirst({
            where: {
              tenantId,
              warehouseId: dto.warehouseId,
              status: 'OPEN',
            },
          });
          await tx.sale.create({
            data: {
              tenantId,
              customerId: customer.id,
              warehouseId: dto.warehouseId,
              cashSessionId: openCash?.id,
              number: `C-${Date.now().toString(36).toUpperCase()}`,
              trigger: SaleTrigger.CONSUMPTION,
              status: 'PENDING',
              totalAmount,
              amountPaid: toDecimal(0),
              referenceType: 'CONSUMPTION',
              referenceId: created.id,
              lines: { create: saleLines },
            },
          });
        }

        return created;
      });

      this.realtime.emitToTenant(tenantId, 'consumption.created', {
        id: consumption.id,
        customerId: consumption.customerId,
        warehouseId: consumption.warehouseId,
        lines: consumption.lines.map((l) => ({
          productId: l.productId,
          sku: l.product.sku,
          quantityBase: l.quantityBase.toString(),
        })),
      });

      return { replay: false, consumption };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const again = await this.prisma.consumption.findUnique({
          where: {
            tenantId_idempotencyKey: { tenantId, idempotencyKey },
          },
          include: {
            customer: true,
            warehouse: true,
            lines: { include: { product: true } },
          },
        });
        if (again) {
          this.assertPayloadMatch(again, dto);
          return { replay: true, consumption: again };
        }
      }
      throw err;
    }
  }

  private assertPayloadMatch(
    existing: {
      customerId: string;
      warehouseId: string;
      lines: { productId: string; quantityBase: Prisma.Decimal }[];
    },
    dto: CreateConsumptionDto,
  ) {
    if (
      existing.customerId !== dto.customerId ||
      existing.warehouseId !== dto.warehouseId
    ) {
      throw new ConflictException(
        'Idempotency-Key reutilizada con payload distinto',
      );
    }
    if (existing.lines.length !== dto.lines.length) {
      throw new ConflictException(
        'Idempotency-Key reutilizada con payload distinto',
      );
    }
  }
}
