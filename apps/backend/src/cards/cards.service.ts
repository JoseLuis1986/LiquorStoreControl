import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CardStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generateCardToken, hashCardToken } from '../common/utils/card-token';
import { IssueCardDto } from './dto/card.dto';

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, customerId?: string) {
    return this.prisma.card.findMany({
      where: { tenantId, ...(customerId ? { customerId } : {}) },
      include: {
        customer: { select: { id: true, code: true, name: true, status: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async issue(tenantId: string, dto: IssueCardDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, tenantId },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    if (customer.status === 'BLOCKED') {
      throw new BadRequestException('Cliente bloqueado');
    }

    const token = generateCardToken();
    const tokenHash = hashCardToken(token);
    const card = await this.prisma.card.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        tokenHash,
        label: dto.label,
        status: CardStatus.ACTIVE,
      },
    });
    // Token en claro solo al emitir
    return { ...card, token };
  }

  async revoke(tenantId: string, id: string, status: CardStatus = CardStatus.REVOKED) {
    const card = await this.prisma.card.findFirst({ where: { id, tenantId } });
    if (!card) throw new NotFoundException('Tarjeta no encontrada');
    return this.prisma.card.update({
      where: { id },
      data: { status, revokedAt: new Date() },
    });
  }

  /** Emite nueva tarjeta y revoca la anterior activa (reposición). */
  async replace(tenantId: string, id: string) {
    const old = await this.prisma.card.findFirst({ where: { id, tenantId } });
    if (!old) throw new NotFoundException('Tarjeta no encontrada');
    await this.prisma.card.update({
      where: { id },
      data: { status: CardStatus.REVOKED, revokedAt: new Date() },
    });
    return this.issue(tenantId, {
      customerId: old.customerId,
      label: old.label ? `${old.label} (reposición)` : 'Reposición',
    });
  }

  async resolve(tenantId: string, token: string) {
    const tokenHash = hashCardToken(token.trim());
    const card = await this.prisma.card.findFirst({
      where: { tenantId, tokenHash },
      include: {
        customer: true,
      },
    });
    if (!card) throw new NotFoundException('Tarjeta no reconocida');
    if (card.status !== CardStatus.ACTIVE) {
      throw new BadRequestException(`Tarjeta ${card.status.toLowerCase()}`);
    }
    if (card.customer.status !== 'ACTIVE') {
      throw new BadRequestException('Cliente inactivo o bloqueado');
    }
    const balances = await this.prisma.customerAllocationBalance.findMany({
      where: {
        tenantId,
        customerId: card.customerId,
        quantityBase: { gt: 0 },
      },
      include: { product: true, warehouse: true },
    });
    return {
      card: {
        id: card.id,
        status: card.status,
        label: card.label,
        issuedAt: card.issuedAt,
      },
      customer: card.customer,
      allocationBalances: balances,
    };
  }
}
