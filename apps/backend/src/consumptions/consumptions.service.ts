import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SaleTrigger } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toDecimal } from '../common/utils/decimal';
import { CreateConsumptionDto } from './dto/consumption.dto';

@Injectable()
export class ConsumptionsService {
  constructor(private readonly prisma: PrismaService) {}

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
              `Saldo asignado insuficiente para producto ${line.productId}`,
            );
          }
          await tx.customerAllocationBalance.update({
            where: { id: bal.id },
            data: {
              quantityBase: { decrement: qty },
              quantityConsumed: { increment: qty },
            },
          });
        }

        const modes = (customer.billingModes as string[]) ?? [];
        if (modes.includes('CHARGE_ON_CONSUMPTION')) {
          await tx.sale.create({
            data: {
              tenantId,
              customerId: customer.id,
              trigger: SaleTrigger.CONSUMPTION,
              status: 'PENDING',
              totalAmount: toDecimal(0),
              referenceType: 'CONSUMPTION',
              referenceId: created.id,
              lines: {
                create: dto.lines.map((l) => ({
                  productId: l.productId,
                  quantityBase: toDecimal(l.quantityBase),
                  unitPrice: toDecimal(0),
                  lineTotal: toDecimal(0),
                })),
              },
            },
          });
        }

        return created;
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
