import { networkInterfaces } from 'node:os';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generateCardToken, hashCardToken } from '../common/utils/card-token';
import { IssueCardDto } from './dto/card.dto';
import { buildCardSvg } from './card-artwork';

const CARD_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** IP de la Wi-Fi de esta máquina. Ignora localhost y las redes de Docker. */
function lanIpv4(): string | null {
  const found: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      const v4 = net.family === 'IPv4' || (net.family as unknown) === 4;
      if (!v4 || net.internal) continue;
      if (net.address.startsWith('127.')) continue;
      if (net.address.startsWith('172.')) continue;
      found.push(net.address);
    }
  }
  return found[0] ?? null;
}

/** El QR abre el servidor actual, no una IP vieja guardada en PUBLIC_APP_URL. */
export function cardAppOrigin(configured?: string): string {
  const lan = lanIpv4();
  const fallback = lan ? `http://${lan}:5173` : 'http://localhost:5173';
  if (!configured) return fallback;
  try {
    const url = new URL(configured);
    if (lan && url.hostname !== lan && url.hostname !== 'localhost') return fallback;
    return configured.replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

/** Id de tarjeta a partir del enlace impreso, de LSC1:uuid o del uuid solo. */
export function cardIdFromScan(raw: string): string | null {
  const text = raw.trim();
  if (/^https?:\/\//i.test(text)) {
    try {
      const card = new URL(text).searchParams.get('card');
      if (card && CARD_ID.test(card)) return card;
    } catch {
      return null;
    }
    return null;
  }
  const id = text.startsWith('LSC1:') ? text.slice(5) : text;
  return CARD_ID.test(id) ? id : null;
}

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

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

  /** SVG CR80 para que el dueño imprima la tarjeta en PVC. El QR es estable (id de la tarjeta). */
  async artwork(tenantId: string, id: string) {
    const card = await this.prisma.card.findFirst({
      where: { id, tenantId },
      include: { customer: true, tenant: true },
    });
    if (!card) throw new NotFoundException('Tarjeta no encontrada');
    const label = card.customer.name;
    const origin = cardAppOrigin(
      this.config.get<string>('PUBLIC_APP_URL') || this.config.get<string>('CORS_ORIGIN'),
    );
    const svg = await buildCardSvg({
      storeName: card.tenant.name,
      code: card.customer.code,
      customerName: card.customer.name,
      payload: `${origin}/servicio?card=${card.id}`,
    });
    const filename = `tarjeta-${card.customer.code}.svg`;
    return { svg, filename, label };
  }

  async resolve(tenantId: string, token: string) {
    const raw = token.trim();
    const printedId = cardIdFromScan(raw);
    const card = printedId
      ? await this.prisma.card.findFirst({
          where: { tenantId, id: printedId },
          include: { customer: true },
        })
      : await this.prisma.card.findFirst({
          where: { tenantId, tokenHash: hashCardToken(raw) },
          include: { customer: true },
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
