import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { toDecimal } from '../common/utils/decimal';
import { CreateTransferDto } from './dto/transfer.dto';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly realtime: RealtimeService,
  ) {}

  list(tenantId: string) {
    return this.prisma.stockTransfer.findMany({
      where: { tenantId },
      include: {
        fromWarehouse: { include: { branch: true } },
        toWarehouse: { include: { branch: true } },
        lines: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async create(tenantId: string, userId: string, dto: CreateTransferDto) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Origen y destino deben ser distintos');
    }
    const [from, to] = await Promise.all([
      this.prisma.warehouse.findFirst({
        where: { id: dto.fromWarehouseId, tenantId, active: true },
      }),
      this.prisma.warehouse.findFirst({
        where: { id: dto.toWarehouseId, tenantId, active: true },
      }),
    ]);
    if (!from || !to) throw new NotFoundException('Almacén no encontrado');

    const number = `TR-${Date.now().toString(36).toUpperCase()}`;
    return this.prisma.stockTransfer.create({
      data: {
        tenantId,
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        createdByUserId: userId,
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
      include: {
        lines: { include: { product: true } },
        fromWarehouse: true,
        toWarehouse: true,
      },
    });
  }

  async complete(tenantId: string, userId: string, id: string) {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id, tenantId },
      include: { lines: true, fromWarehouse: true, toWarehouse: true },
    });
    if (!transfer) throw new NotFoundException('Transferencia no encontrada');
    if (transfer.status === 'COMPLETED') return transfer;
    if (transfer.status === 'CANCELLED') {
      throw new BadRequestException('Transferencia cancelada');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const line of transfer.lines) {
        const qty = toDecimal(line.quantityBase);
        await this.inventory.applyDelta(tenantId, userId, {
          warehouseId: transfer.fromWarehouseId,
          productId: line.productId,
          delta: qty.neg(),
          type: InventoryMovementType.TRANSFER_OUT,
          referenceType: 'TRANSFER',
          referenceId: transfer.id,
          notes: `Transferencia ${transfer.number} → ${transfer.toWarehouse.code}`,
          tx,
        });
        await this.inventory.applyDelta(tenantId, userId, {
          warehouseId: transfer.toWarehouseId,
          productId: line.productId,
          delta: qty,
          type: InventoryMovementType.TRANSFER_IN,
          referenceType: 'TRANSFER',
          referenceId: transfer.id,
          notes: `Transferencia ${transfer.number} ← ${transfer.fromWarehouse.code}`,
          tx,
        });
      }
      await tx.stockTransfer.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    });

    const result = await this.prisma.stockTransfer.findUniqueOrThrow({
      where: { id },
      include: {
        lines: { include: { product: true } },
        fromWarehouse: { include: { branch: true } },
        toWarehouse: { include: { branch: true } },
      },
    });

    this.realtime.emitToTenant(tenantId, 'transfer.completed', {
      id: result.id,
      number: result.number,
      from: result.fromWarehouse.code,
      to: result.toWarehouse.code,
    });
    this.realtime.emitToTenant(tenantId, 'inventory.changed', {
      reason: 'transfer',
      transferId: result.id,
    });

    return result;
  }
}
