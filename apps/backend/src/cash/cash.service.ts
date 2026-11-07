import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toDecimal } from '../common/utils/decimal';
import { CloseCashSessionDto, OpenCashSessionDto } from './dto/cash.dto';

@Injectable()
export class CashService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.cashSession.findMany({
      where: { tenantId },
      include: {
        warehouse: true,
        openedByUser: { select: { id: true, fullName: true } },
        closedByUser: { select: { id: true, fullName: true } },
      },
      orderBy: { openedAt: 'desc' },
      take: 50,
    });
  }

  async currentOpen(tenantId: string, warehouseId?: string) {
    return this.prisma.cashSession.findFirst({
      where: {
        tenantId,
        status: 'OPEN',
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: { warehouse: true },
      orderBy: { openedAt: 'desc' },
    });
  }

  async open(tenantId: string, userId: string, dto: OpenCashSessionDto) {
    const existing = await this.prisma.cashSession.findFirst({
      where: { tenantId, warehouseId: dto.warehouseId, status: 'OPEN' },
    });
    if (existing) {
      throw new ConflictException('Ya hay una caja abierta en este almacén');
    }
    const wh = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, tenantId, active: true },
    });
    if (!wh) throw new NotFoundException('Almacén no encontrado');

    return this.prisma.cashSession.create({
      data: {
        tenantId,
        warehouseId: dto.warehouseId,
        openedByUserId: userId,
        openingFloat: toDecimal(dto.openingFloat ?? 0),
        notes: dto.notes,
        status: 'OPEN',
      },
      include: { warehouse: true },
    });
  }

  async close(
    tenantId: string,
    userId: string,
    sessionId: string,
    dto: CloseCashSessionDto,
  ) {
    const session = await this.prisma.cashSession.findFirst({
      where: { id: sessionId, tenantId },
      include: { payments: true },
    });
    if (!session) throw new NotFoundException('Sesión de caja no encontrada');
    if (session.status !== 'OPEN') {
      throw new BadRequestException('La caja ya está cerrada');
    }

    const cashPayments = session.payments
      .filter((p) => p.method === 'CASH' && p.status === 'COMPLETED')
      .reduce((acc, p) => acc.add(p.amount), toDecimal(0));
    const expectedCash = toDecimal(session.openingFloat).add(cashPayments);

    return this.prisma.cashSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedByUserId: userId,
        closedAt: new Date(),
        closingAmount: toDecimal(dto.closingAmount),
        expectedCash,
        notes: dto.notes ?? session.notes,
      },
      include: {
        warehouse: true,
        payments: true,
        sales: true,
      },
    });
  }

  async summary(tenantId: string, sessionId: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        warehouse: true,
        payments: true,
        sales: { include: { customer: true, lines: true } },
      },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');

    const byMethod: Record<string, number> = {};
    for (const p of session.payments.filter((x) => x.status === 'COMPLETED')) {
      byMethod[p.method] =
        (byMethod[p.method] ?? 0) + Number(p.amount.toString());
    }
    return { session, totalsByMethod: byMethod };
  }
}
