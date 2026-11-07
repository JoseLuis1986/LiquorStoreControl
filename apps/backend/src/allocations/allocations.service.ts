import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  Prisma,
  SaleTrigger,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { toDecimal } from '../common/utils/decimal';
import { resolveUnitPrice } from '../common/utils/pricing';
import { CreateAllocationDto } from './dto/allocation.dto';

@Injectable()
export class AllocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  list(tenantId: string, customerId?: string) {
    return this.prisma.allocation.findMany({
      where: {
        tenantId,
        ...(customerId ? { customerId } : {}),
      },
      include: {
        customer: true,
        warehouse: true,
        lines: { include: { product: true, presentation: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async create(tenantId: string, userId: string, dto: CreateAllocationDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, tenantId },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    if (customer.status !== 'ACTIVE') {
      throw new BadRequestException('Cliente inactivo o bloqueado');
    }

    const resolvedLines: {
      productId: string;
      presentationId: string | null;
      quantityBase: Prisma.Decimal;
    }[] = [];

    for (const line of dto.lines) {
      const product = await this.prisma.product.findFirst({
        where: { id: line.productId, tenantId, active: true },
      });
      if (!product) {
        throw new NotFoundException(`Producto ${line.productId} no encontrado`);
      }
      let quantityBase = toDecimal(line.quantity);
      let presentationId: string | null = null;
      if (line.presentationId) {
        const presentation = await this.prisma.productPresentation.findFirst({
          where: {
            id: line.presentationId,
            tenantId,
            productId: line.productId,
          },
        });
        if (!presentation) {
          throw new NotFoundException('Presentación no encontrada');
        }
        quantityBase = toDecimal(line.quantity).mul(presentation.factorToBase);
        presentationId = presentation.id;
      }
      resolvedLines.push({
        productId: line.productId,
        presentationId,
        quantityBase,
      });
    }

    const allocation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.allocation.create({
        data: {
          tenantId,
          customerId: dto.customerId,
          warehouseId: dto.warehouseId,
          createdByUserId: userId,
          notes: dto.notes,
          lines: {
            create: resolvedLines.map((l) => ({
              productId: l.productId,
              presentationId: l.presentationId,
              quantityBase: l.quantityBase,
            })),
          },
        },
        include: { lines: true, customer: true, warehouse: true },
      });

      for (const line of resolvedLines) {
        // ↓ inventario general
        await this.inventory.applyDelta(tenantId, userId, {
          warehouseId: dto.warehouseId,
          productId: line.productId,
          delta: line.quantityBase.neg(),
          type: InventoryMovementType.ALLOCATION_OUT,
          referenceType: 'ALLOCATION',
          referenceId: created.id,
          notes: 'Asignación a cliente',
          tx,
        });

        // ↑ saldo asignado
        const bal = await tx.customerAllocationBalance.upsert({
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
          },
          update: {
            quantityBase: { increment: line.quantityBase },
            quantityAssigned: { increment: line.quantityBase },
          },
        });
        void bal;
      }

      // Cobro real si billingModes incluye CHARGE_ON_ALLOCATION
      const modes = (customer.billingModes as string[]) ?? [];
      if (modes.includes('CHARGE_ON_ALLOCATION')) {
        const saleLines = [];
        for (const l of resolvedLines) {
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
            trigger: SaleTrigger.ALLOCATION,
            status: 'PENDING',
            totalAmount,
            amountPaid: toDecimal(0),
            referenceType: 'ALLOCATION',
            referenceId: created.id,
            lines: { create: saleLines },
          },
        });
      }

      return created;
    });

    return this.prisma.allocation.findUniqueOrThrow({
      where: { id: allocation.id },
      include: {
        lines: { include: { product: true, presentation: true } },
        customer: true,
        warehouse: true,
      },
    });
  }

  /** Revierte asignación: ↑ inventario, ↓ saldo (returned), no edita movimientos. */
  async reverse(tenantId: string, userId: string, allocationId: string) {
    const allocation = await this.prisma.allocation.findFirst({
      where: { id: allocationId, tenantId },
      include: { lines: true, customer: true },
    });
    if (!allocation) throw new NotFoundException('Asignación no encontrada');
    if (allocation.status === 'REVERSED') {
      throw new ConflictException('Asignación ya revertida');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const line of allocation.lines) {
        const qty = toDecimal(line.quantityBase);
        const bal = await tx.customerAllocationBalance.findUnique({
          where: {
            tenantId_customerId_warehouseId_productId: {
              tenantId,
              customerId: allocation.customerId,
              warehouseId: allocation.warehouseId,
              productId: line.productId,
            },
          },
        });
        if (!bal || toDecimal(bal.quantityBase).lt(qty)) {
          throw new ConflictException(
            'Saldo asignado insuficiente para devolver (ya consumido)',
          );
        }

        await tx.customerAllocationBalance.update({
          where: { id: bal.id },
          data: {
            quantityBase: { decrement: qty },
            quantityReturned: { increment: qty },
          },
        });

        await this.inventory.applyDelta(tenantId, userId, {
          warehouseId: allocation.warehouseId,
          productId: line.productId,
          delta: qty,
          type: InventoryMovementType.ALLOCATION_REVERSAL,
          referenceType: 'ALLOCATION',
          referenceId: allocation.id,
          notes: 'Devolución / reversión de asignación',
          tx,
        });
      }

      await tx.allocation.update({
        where: { id: allocation.id },
        data: { status: 'REVERSED' },
      });
    });

    return this.prisma.allocation.findUniqueOrThrow({
      where: { id: allocationId },
      include: {
        lines: { include: { product: true, presentation: true } },
        customer: true,
        warehouse: true,
      },
    });
  }
}
