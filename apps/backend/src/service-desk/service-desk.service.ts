import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ServiceDeskService {
  constructor(private readonly prisma: PrismaService) {}

  async visit(tenantId: string, userId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    const since = new Date(Date.now() - 2 * 60 * 1000);
    const recent = await this.prisma.serviceVisit.findFirst({
      where: { tenantId, userId, customerId, createdAt: { gte: since } },
    });
    if (recent) return recent;
    return this.prisma.serviceVisit.create({
      data: { tenantId, userId, customerId },
    });
  }

  async active(tenantId: string) {
    const since = new Date(Date.now() - WINDOW_MS);
    const [balances, visits, dispatches] = await Promise.all([
      this.prisma.customerAllocationBalance.findMany({
        where: { tenantId, quantityBase: { gt: 0 } },
        include: {
          product: { select: { name: true } },
          customer: {
            include: {
              cards: {
                where: { status: 'ACTIVE' },
                select: { label: true },
                take: 1,
              },
            },
          },
        },
      }),
      this.prisma.serviceVisit.findMany({
        where: { tenantId, createdAt: { gte: since } },
        include: {
          user: { select: { id: true, fullName: true } },
          customer: {
            include: {
              cards: {
                where: { status: 'ACTIVE' },
                select: { label: true },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.consumption.findMany({
        where: { tenantId, createdAt: { gte: since } },
        include: {
          createdByUser: { select: { id: true, fullName: true } },
          lines: { include: { product: { select: { name: true } } } },
          customer: {
            include: {
              cards: {
                where: { status: 'ACTIVE' },
                select: { label: true },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    type CustomerBits = {
      id: string;
      code: string;
      name: string;
      phone: string | null;
      email: string | null;
      cards: { label: string | null }[];
    };
    type Row = {
      customer: CustomerBits;
      pending: { productName: string; quantityBase: string; quantityConsumed: string }[];
      events: {
        kind: 'SCAN' | 'DISPATCH';
        at: string;
        userId: string;
        userName: string;
        lines: { productName: string; quantityBase: string }[];
      }[];
    };
    const rows = new Map<string, Row>();

    const ensure = (customer: CustomerBits) => {
      let row = rows.get(customer.id);
      if (!row) {
        row = { customer, pending: [], events: [] };
        rows.set(customer.id, row);
      }
      return row;
    };

    for (const balance of balances) {
      const row = ensure(balance.customer);
      row.pending.push({
        productName: balance.product.name,
        quantityBase: balance.quantityBase.toString(),
        quantityConsumed: balance.quantityConsumed.toString(),
      });
    }
    for (const visit of visits) {
      ensure(visit.customer).events.push({
        kind: 'SCAN',
        at: visit.createdAt.toISOString(),
        userId: visit.user.id,
        userName: visit.user.fullName,
        lines: [],
      });
    }
    for (const dispatch of dispatches) {
      ensure(dispatch.customer).events.push({
        kind: 'DISPATCH',
        at: dispatch.createdAt.toISOString(),
        userId: dispatch.createdByUser.id,
        userName: dispatch.createdByUser.fullName,
        lines: dispatch.lines.map((line) => ({
          productName: line.product.name,
          quantityBase: line.quantityBase.toString(),
        })),
      });
    }

    return [...rows.values()]
      .map((row) => ({
        customer: {
          id: row.customer.id,
          code: row.customer.code,
          name: row.customer.name,
          phone: row.customer.phone,
          email: row.customer.email,
          cardLabel: row.customer.cards[0]?.label ?? null,
        },
        pending: row.pending,
        events: row.events.sort((a, b) => (a.at < b.at ? 1 : -1)),
      }))
      .sort((a, b) => {
        const aPending = a.pending.length > 0 ? 1 : 0;
        const bPending = b.pending.length > 0 ? 1 : 0;
        if (aPending !== bPending) return bPending - aPending;
        return (b.events[0]?.at ?? '').localeCompare(a.events[0]?.at ?? '');
      });
  }

  myDispatches(tenantId: string, userId: string) {
    return this.prisma.consumption.findMany({
      where: { tenantId, createdByUserId: userId },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        lines: { include: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
