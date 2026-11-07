import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
      include: {
        warehouse: true,
        supplier: true,
        lines: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, dto: CreateOrderDto) {
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, tenantId, active: true },
      });
      if (!supplier) throw new NotFoundException('Proveedor no encontrado');
    }

    const lines = dto.lines.map((l) => {
      const qty = toDecimal(l.quantityBase);
      const unitCost = toDecimal(l.unitCost ?? 0);
      return {
        productId: l.productId,
        quantityBase: qty,
        unitCost,
        lineTotal: qty.mul(unitCost),
      };
    });
    const totalAmount = lines.reduce(
      (acc, l) => acc.add(l.lineTotal),
      toDecimal(0),
    );

    const number =
      dto.number ?? `PO-${Date.now().toString(36).toUpperCase()}`;

    return this.prisma.order.create({
      data: {
        tenantId,
        warehouseId: dto.warehouseId,
        supplierId: dto.supplierId,
        number,
        notes: dto.notes,
        status: 'DRAFT',
        totalAmount,
        lines: { create: lines },
      },
      include: {
        lines: { include: { product: true } },
        warehouse: true,
        supplier: true,
      },
    });
  }

  async confirm(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.status !== 'DRAFT') {
      throw new BadRequestException('Solo se confirman pedidos DRAFT');
    }
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED' },
      include: {
        lines: { include: { product: true } },
        warehouse: true,
        supplier: true,
      },
    });
  }

  /** Recepción: genera movimientos PURCHASE_IN inmutables. */
  async receive(tenantId: string, userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { lines: true, supplier: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.status === 'RECEIVED') {
      return this.prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          lines: { include: { product: true } },
          warehouse: true,
          supplier: true,
        },
      });
    }
    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Pedido cancelado');
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
          notes: `Recepción OC ${order.number}${
            order.supplier ? ` / ${order.supplier.name}` : ''
          }`,
          tx,
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      });
    });

    return this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        lines: { include: { product: true } },
        warehouse: true,
        supplier: true,
      },
    });
  }
}
