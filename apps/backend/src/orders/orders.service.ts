import { Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { toDecimal } from '../common/utils/decimal';
import { CreateOrderDto } from './dto/order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  list(tenantId: string) {
    return this.prisma.order.findMany({
      where: { tenantId },
      include: { warehouse: true, lines: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, dto: CreateOrderDto) {
    const number =
      dto.number ??
      `ORD-${Date.now().toString(36).toUpperCase()}`;
    return this.prisma.order.create({
      data: {
        tenantId,
        warehouseId: dto.warehouseId,
        number,
        notes: dto.notes,
        status: 'DRAFT',
        lines: {
          create: dto.lines.map((l) => ({
            productId: l.productId,
            quantityBase: toDecimal(l.quantityBase),
          })),
        },
      },
      include: { lines: { include: { product: true } }, warehouse: true },
    });
  }

  /** Confirma y recibe el pedido: entrada a inventario general. */
  async receive(tenantId: string, userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { lines: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.status === 'RECEIVED') return order;
    if (order.status === 'CANCELLED') {
      throw new NotFoundException('Pedido cancelado');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const line of order.lines) {
        await this.inventory.applyDelta(tenantId, userId, {
          warehouseId: order.warehouseId,
          productId: line.productId,
          delta: toDecimal(line.quantityBase),
          type: InventoryMovementType.PURCHASE_IN,
          referenceType: 'ORDER',
          referenceId: order.id,
          notes: `Recepción pedido ${order.number}`,
          tx,
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'RECEIVED' },
      });
    });

    return this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { lines: { include: { product: true } }, warehouse: true },
    });
  }
}
