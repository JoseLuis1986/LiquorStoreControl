import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toDecimal } from '../common/utils/decimal';
import { AdjustInventoryDto, InitialStockDto } from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  listBalances(tenantId: string, warehouseId?: string) {
    return this.prisma.inventoryBalance.findMany({
      where: {
        tenantId,
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: { product: true, warehouse: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  listMovements(
    tenantId: string,
    opts: { warehouseId?: string; productId?: string; take?: number } = {},
  ) {
    return this.prisma.inventoryMovement.findMany({
      where: {
        tenantId,
        ...(opts.warehouseId ? { warehouseId: opts.warehouseId } : {}),
        ...(opts.productId ? { productId: opts.productId } : {}),
      },
      include: { product: true, warehouse: true },
      orderBy: { createdAt: 'desc' },
      take: opts.take ?? 100,
    });
  }

  /** Entrada inicial / compra → PURCHASE_IN */
  async initialStock(
    tenantId: string,
    userId: string,
    dto: InitialStockDto,
  ) {
    return this.applyDelta(tenantId, userId, {
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      delta: toDecimal(dto.quantityBase),
      type: InventoryMovementType.PURCHASE_IN,
      notes: dto.notes ?? 'Entrada inicial',
      referenceType: 'INITIAL_STOCK',
    });
  }

  async adjust(tenantId: string, userId: string, dto: AdjustInventoryDto) {
    const delta = toDecimal(dto.quantityBase);
    if (delta.eq(0)) throw new BadRequestException('Cantidad no puede ser 0');
    const type =
      delta.gt(0)
        ? InventoryMovementType.ADJUSTMENT_IN
        : InventoryMovementType.ADJUSTMENT_OUT;
    return this.applyDelta(tenantId, userId, {
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      delta,
      type,
      notes: dto.notes,
      referenceType: 'ADJUSTMENT',
    });
  }

  async reverseMovement(tenantId: string, userId: string, movementId: string) {
    const original = await this.prisma.inventoryMovement.findFirst({
      where: { id: movementId, tenantId },
    });
    if (!original) throw new NotFoundException('Movimiento no encontrado');
    const already = await this.prisma.inventoryMovement.findFirst({
      where: { tenantId, reversesMovementId: movementId },
    });
    if (already) throw new ConflictException('Movimiento ya revertido');

    const reverseType = this.reverseTypeOf(original.type);
    const delta = toDecimal(original.quantityBase).neg();
    return this.applyDelta(tenantId, userId, {
      warehouseId: original.warehouseId,
      productId: original.productId,
      delta,
      type: reverseType,
      notes: `Reversión de ${original.id}`,
      referenceType: original.referenceType,
      referenceId: original.referenceId ?? undefined,
      reversesMovementId: original.id,
    });
  }

  /**
   * Aplica delta firmado al balance + crea movimiento inmutable.
   * Usado también por allocations.
   */
  async applyDelta(
    tenantId: string,
    userId: string | null,
    args: {
      warehouseId: string;
      productId: string;
      delta: Prisma.Decimal;
      type: InventoryMovementType;
      notes?: string | null;
      referenceType?: string | null;
      referenceId?: string | null;
      reversesMovementId?: string | null;
      tx?: Prisma.TransactionClient;
    },
  ) {
    const run = async (tx: Prisma.TransactionClient) => {
      const product = await tx.product.findFirst({
        where: { id: args.productId, tenantId, active: true },
      });
      if (!product) throw new NotFoundException('Producto no encontrado o inactivo');
      const warehouse = await tx.warehouse.findFirst({
        where: { id: args.warehouseId, tenantId, active: true },
      });
      if (!warehouse) throw new NotFoundException('Almacén no encontrado o inactivo');

      let balance = await tx.inventoryBalance.findUnique({
        where: {
          tenantId_warehouseId_productId: {
            tenantId,
            warehouseId: args.warehouseId,
            productId: args.productId,
          },
        },
      });
      if (!balance) {
        balance = await tx.inventoryBalance.create({
          data: {
            tenantId,
            warehouseId: args.warehouseId,
            productId: args.productId,
            quantityBase: toDecimal(0),
          },
        });
      }

      const next = toDecimal(balance.quantityBase).add(args.delta);
      if (next.lt(0)) {
        throw new ConflictException('Stock insuficiente en inventario general');
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          tenantId,
          warehouseId: args.warehouseId,
          productId: args.productId,
          type: args.type,
          quantityBase: args.delta,
          notes: args.notes ?? undefined,
          referenceType: args.referenceType ?? undefined,
          referenceId: args.referenceId ?? undefined,
          reversesMovementId: args.reversesMovementId ?? undefined,
          createdByUserId: userId ?? undefined,
        },
      });

      const updated = await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: { quantityBase: next },
        include: { product: true, warehouse: true },
      });

      return { movement, balance: updated };
    };

    if (args.tx) return run(args.tx);
    return this.prisma.$transaction(run);
  }

  private reverseTypeOf(type: InventoryMovementType): InventoryMovementType {
    switch (type) {
      case InventoryMovementType.PURCHASE_IN:
        return InventoryMovementType.ADJUSTMENT_OUT;
      case InventoryMovementType.ADJUSTMENT_IN:
        return InventoryMovementType.ADJUSTMENT_OUT;
      case InventoryMovementType.ADJUSTMENT_OUT:
        return InventoryMovementType.ADJUSTMENT_IN;
      case InventoryMovementType.ALLOCATION_OUT:
        return InventoryMovementType.ALLOCATION_REVERSAL;
      case InventoryMovementType.ALLOCATION_REVERSAL:
        return InventoryMovementType.ALLOCATION_OUT;
      case InventoryMovementType.SALE_OUT:
        return InventoryMovementType.SALE_REVERSAL;
      case InventoryMovementType.SALE_REVERSAL:
        return InventoryMovementType.SALE_OUT;
      case InventoryMovementType.TRANSFER_IN:
        return InventoryMovementType.TRANSFER_OUT;
      case InventoryMovementType.TRANSFER_OUT:
        return InventoryMovementType.TRANSFER_IN;
      default:
        return InventoryMovementType.ADJUSTMENT_IN;
    }
  }
}
