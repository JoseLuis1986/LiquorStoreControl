import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  Prisma,
  ReturnType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { toDecimal } from '../common/utils/decimal';
import { resolveUnitPrice } from '../common/utils/pricing';
import { CreateReturnDto } from './dto/return.dto';

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  list(tenantId: string) {
    return this.prisma.stockReturn.findMany({
      where: { tenantId },
      include: {
        customer: true,
        warehouse: true,
        sale: true,
        lines: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.stockReturn.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        warehouse: true,
        sale: { include: { payments: true, lines: true } },
        lines: { include: { product: true } },
        createdByUser: { select: { fullName: true } },
      },
    });
    if (!row) throw new NotFoundException('Devolución no encontrada');
    return row;
  }

  async create(tenantId: string, userId: string, dto: CreateReturnDto) {
    if (dto.type === ReturnType.ALLOCATION) {
      return this.returnAllocation(tenantId, userId, dto);
    }
    if (dto.type === ReturnType.SALE) {
      return this.returnSale(tenantId, userId, dto);
    }
    throw new BadRequestException('Tipo de devolución no soportado');
  }

  /** Devolución de asignación no consumida: ↑ inventario + ↑ returned / ↓ remaining. */
  private async returnAllocation(
    tenantId: string,
    userId: string,
    dto: CreateReturnDto,
  ) {
    if (!dto.customerId) {
      throw new BadRequestException('customerId requerido para devolución de asignación');
    }
    if (!dto.allocationId) {
      throw new BadRequestException('allocationId requerido');
    }

    const allocation = await this.prisma.allocation.findFirst({
      where: { id: dto.allocationId, tenantId },
      include: { lines: true },
    });
    if (!allocation) throw new NotFoundException('Asignación no encontrada');
    if (allocation.status === 'REVERSED') {
      throw new ConflictException('Asignación ya revertida');
    }
    if (allocation.customerId !== dto.customerId) {
      throw new BadRequestException('Cliente no coincide con la asignación');
    }

    const id = await this.prisma.$transaction(async (tx) => {
      const lineData: {
        productId: string;
        quantityBase: Prisma.Decimal;
        unitPrice: Prisma.Decimal;
        lineCredit: Prisma.Decimal;
      }[] = [];

      for (const line of dto.lines) {
        const qty = toDecimal(line.quantityBase);
        const allocLine = allocation.lines.find(
          (l) => l.productId === line.productId,
        );
        if (!allocLine) {
          throw new BadRequestException(
            `Producto ${line.productId} no está en la asignación`,
          );
        }

        const bal = await tx.customerAllocationBalance.findUnique({
          where: {
            tenantId_customerId_warehouseId_productId: {
              tenantId,
              customerId: dto.customerId!,
              warehouseId: dto.warehouseId,
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
          warehouseId: dto.warehouseId,
          productId: line.productId,
          delta: qty,
          type: InventoryMovementType.ALLOCATION_REVERSAL,
          referenceType: 'RETURN',
          referenceId: allocation.id,
          notes: 'Devolución de asignación',
          tx,
        });

        const unitPrice =
          line.unitPrice != null
            ? toDecimal(line.unitPrice)
            : await resolveUnitPrice(tx, tenantId, line.productId, dto.customerId);
        lineData.push({
          productId: line.productId,
          quantityBase: qty,
          unitPrice,
          lineCredit: qty.mul(unitPrice),
        });
      }

      // Si se devolvió todo lo asignado pendiente de las líneas, marcar REVERSED
      // solo cuando todas las líneas de la asignación quedan sin saldo restante
      // vinculado a esa asignación. Simplificación: marcar REVERSED si qty
      // devuelta == qty de cada línea de la asignación.
      const fullyReturned = allocation.lines.every((al) => {
        const ret = dto.lines.find((l) => l.productId === al.productId);
        return ret && toDecimal(ret.quantityBase).gte(al.quantityBase);
      });
      if (fullyReturned) {
        await tx.allocation.update({
          where: { id: allocation.id },
          data: { status: 'REVERSED' },
        });
      }

      // Nota de crédito sobre venta PENDING ligada a la asignación (si existe)
      const linkedSale = await tx.sale.findFirst({
        where: {
          tenantId,
          referenceType: 'ALLOCATION',
          referenceId: allocation.id,
          status: { in: ['PENDING', 'PARTIAL'] },
        },
      });
      const totalCredit = lineData.reduce(
        (a, l) => a.add(l.lineCredit),
        toDecimal(0),
      );
      if (linkedSale) {
        const newTotal = toDecimal(linkedSale.totalAmount).sub(totalCredit);
        await tx.sale.update({
          where: { id: linkedSale.id },
          data: {
            totalAmount: newTotal.lt(0) ? toDecimal(0) : newTotal,
            status:
              newTotal.lte(0) && toDecimal(linkedSale.amountPaid).lte(0)
                ? 'CANCELLED'
                : linkedSale.status,
          },
        });
      }

      const number = `DEV-${Date.now().toString(36).toUpperCase()}`;
      const created = await tx.stockReturn.create({
        data: {
          tenantId,
          warehouseId: dto.warehouseId,
          customerId: dto.customerId,
          allocationId: allocation.id,
          saleId: linkedSale?.id,
          createdByUserId: userId,
          type: ReturnType.ALLOCATION,
          number,
          reason: dto.reason,
          totalCredit,
          lines: { create: lineData },
        },
      });
      return created.id;
    });

    return this.get(tenantId, id);
  }

  /** Devolución de venta: reintegra stock con SALE_REVERSAL + crédito. */
  private async returnSale(
    tenantId: string,
    userId: string,
    dto: CreateReturnDto,
  ) {
    if (!dto.saleId) throw new BadRequestException('saleId requerido');
    const sale = await this.prisma.sale.findFirst({
      where: { id: dto.saleId, tenantId },
      include: { lines: true },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    if (!sale.warehouseId && !dto.warehouseId) {
      throw new BadRequestException('warehouseId requerido');
    }
    const warehouseId = dto.warehouseId || sale.warehouseId!;

    const id = await this.prisma.$transaction(async (tx) => {
      const lineData = [];
      for (const line of dto.lines) {
        const qty = toDecimal(line.quantityBase);
        const saleLine = sale.lines.find((l) => l.productId === line.productId);
        if (!saleLine) {
          throw new BadRequestException('Producto no está en la venta');
        }
        if (qty.gt(saleLine.quantityBase)) {
          throw new ConflictException('Cantidad a devolver excede la venta');
        }

        // Solo reintegra inventario si la venta original descontó stock (MANUAL)
        if (sale.trigger === 'MANUAL') {
          await this.inventory.applyDelta(tenantId, userId, {
            warehouseId,
            productId: line.productId,
            delta: qty,
            type: InventoryMovementType.SALE_REVERSAL,
            referenceType: 'RETURN',
            referenceId: sale.id,
            notes: 'Devolución de venta',
            tx,
          });
        }

        const unitPrice =
          line.unitPrice != null
            ? toDecimal(line.unitPrice)
            : toDecimal(saleLine.unitPrice);
        lineData.push({
          productId: line.productId,
          quantityBase: qty,
          unitPrice,
          lineCredit: qty.mul(unitPrice),
        });
      }

      const totalCredit = lineData.reduce(
        (a, l) => a.add(l.lineCredit),
        toDecimal(0),
      );

      // Ajuste de cuenta por cobrar / anulación parcial
      const newTotal = toDecimal(sale.totalAmount).sub(totalCredit);
      let status = sale.status;
      if (newTotal.lte(0)) status = 'CANCELLED';
      else if (toDecimal(sale.amountPaid).gte(newTotal)) status = 'PAID';
      else if (toDecimal(sale.amountPaid).gt(0)) status = 'PARTIAL';
      else status = 'PENDING';

      await tx.sale.update({
        where: { id: sale.id },
        data: {
          totalAmount: newTotal.lt(0) ? toDecimal(0) : newTotal,
          status,
        },
      });

      const number = `DEV-${Date.now().toString(36).toUpperCase()}`;
      const created = await tx.stockReturn.create({
        data: {
          tenantId,
          warehouseId,
          customerId: sale.customerId ?? dto.customerId,
          saleId: sale.id,
          createdByUserId: userId,
          type: ReturnType.SALE,
          number,
          reason: dto.reason,
          totalCredit,
          lines: { create: lineData },
        },
      });
      return created.id;
    });

    return this.get(tenantId, id);
  }
}
