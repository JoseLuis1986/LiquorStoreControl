import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(args: {
    tenantId: string;
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    context?: string | null;
    metadata?: Prisma.InputJsonValue;
    ip?: string | null;
  }) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: args.tenantId,
        actorUserId: args.actorUserId ?? undefined,
        action: args.action,
        entityType: args.entityType,
        entityId: args.entityId ?? undefined,
        context: args.context ?? undefined,
        metadata: args.metadata,
        ip: args.ip ?? undefined,
      },
    });
  }

  list(
    tenantId: string,
    opts: {
      actorUserId?: string;
      entityType?: string;
      action?: string;
      take?: number;
      from?: Date;
      to?: Date;
    } = {},
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(opts.actorUserId ? { actorUserId: opts.actorUserId } : {}),
        ...(opts.entityType ? { entityType: opts.entityType } : {}),
        ...(opts.action ? { action: { contains: opts.action } } : {}),
        ...(opts.from || opts.to
          ? {
              createdAt: {
                ...(opts.from ? { gte: opts.from } : {}),
                ...(opts.to ? { lte: opts.to } : {}),
              },
            }
          : {}),
      },
      include: {
        actor: { select: { id: true, email: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: opts.take ?? 100,
    });
  }
}
