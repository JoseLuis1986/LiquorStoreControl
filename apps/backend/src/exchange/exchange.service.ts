import { BadRequestException, Injectable } from '@nestjs/common';
import { ExchangeRateMode } from '@prisma/client';
import https from 'https';
import { PrismaService } from '../prisma/prisma.service';
import { toDecimal } from '../common/utils/decimal';

export type ExchangeRateView = {
  mode: ExchangeRateMode;
  usdToVes: number;
  source: string;
  fetchedAt: string | null;
  updatedAt: string;
};

@Injectable()
export class ExchangeService {
  constructor(private readonly prisma: PrismaService) {}

  async current(tenantId: string): Promise<ExchangeRateView> {
    let row = await this.ensure(tenantId);
    const stale =
      row.mode === ExchangeRateMode.AUTOMATIC &&
      (!row.fetchedAt || Date.now() - row.fetchedAt.getTime() > 60 * 60 * 1000);
    if (stale) {
      try {
        row = await this.pull(tenantId);
      } catch {
        // Se conserva la última tasa si el BCV no responde.
      }
    }
    return this.view(row);
  }

  async update(
    tenantId: string,
    dto: { mode: 'MANUAL' | 'AUTOMATIC'; usdToVes?: number },
  ) {
    await this.ensure(tenantId);
    if (dto.mode === 'AUTOMATIC') {
      const row = await this.pull(tenantId);
      return this.view(row);
    }
    if (dto.usdToVes == null || !(dto.usdToVes > 0)) {
      throw new BadRequestException('Indica cuántos bolívares vale 1 dólar');
    }
    const row = await this.prisma.exchangeRateSetting.update({
      where: { tenantId },
      data: {
        mode: ExchangeRateMode.MANUAL,
        usdToVes: toDecimal(dto.usdToVes),
        source: 'manual',
        fetchedAt: new Date(),
      },
    });
    return this.view(row);
  }

  async refresh(tenantId: string) {
    await this.ensure(tenantId);
    const row = await this.pull(tenantId);
    return this.view(row);
  }

  private async ensure(tenantId: string) {
    const existing = await this.prisma.exchangeRateSetting.findUnique({
      where: { tenantId },
    });
    if (existing) return existing;
    return this.prisma.exchangeRateSetting.create({
      data: {
        tenantId,
        mode: ExchangeRateMode.AUTOMATIC,
        usdToVes: toDecimal(0),
        source: 'BCV',
      },
    });
  }

  private async pull(tenantId: string) {
    const quote = await this.officialUsd();
    return this.prisma.exchangeRateSetting.update({
      where: { tenantId },
      data: {
        mode: ExchangeRateMode.AUTOMATIC,
        usdToVes: toDecimal(quote.rate),
        source: quote.source,
        fetchedAt: quote.fetchedAt,
      },
    });
  }

  private async officialUsd(): Promise<{ rate: number; source: string; fetchedAt: Date }> {
    try {
      const html = await getText('https://www.bcv.org.ve/');
      const parsed = parseBcvUsd(html);
      if (parsed) return { rate: parsed.rate, source: 'BCV', fetchedAt: parsed.at };
    } catch {
      // El sitio del BCV a veces rechaza el certificado. Se usa el respaldo oficial.
    }
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      throw new BadRequestException('No se pudo consultar la tasa oficial del dólar');
    }
    const body = (await res.json()) as { promedio?: number; fechaActualizacion?: string };
    const rate = Number(body.promedio);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new BadRequestException('La tasa oficial no vino en la respuesta');
    }
    return {
      rate,
      source: 'BCV',
      fetchedAt: body.fechaActualizacion ? new Date(body.fechaActualizacion) : new Date(),
    };
  }

  private view(row: {
    mode: ExchangeRateMode;
    usdToVes: { toString(): string };
    source: string;
    fetchedAt: Date | null;
    updatedAt: Date;
  }): ExchangeRateView {
    return {
      mode: row.mode,
      usdToVes: Number(row.usdToVes),
      source: row.source,
      fetchedAt: row.fetchedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function getText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { rejectUnauthorized: false, timeout: 12000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

function parseBcvUsd(html: string): { rate: number; at: Date } | null {
  const marker = html.indexOf('> USD<');
  if (marker < 0) return null;
  const slice = html.slice(marker, marker + 900);
  const amount = slice.match(/<strong[^>]*>([0-9.,]+)<\/strong>/);
  if (!amount) return null;
  const rate = parseVeNumber(amount[1]);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const date = slice.match(/content="(\d{4}-\d{2}-\d{2}T[^"]+)"/);
  return { rate, at: date ? new Date(date[1]) : new Date() };
}

function parseVeNumber(raw: string): number {
  const text = raw.trim();
  if (text.includes(',') && text.includes('.')) {
    return text.lastIndexOf(',') > text.lastIndexOf('.')
      ? Number(text.replace(/\./g, '').replace(',', '.'))
      : Number(text.replace(/,/g, ''));
  }
  if (text.includes(',')) return Number(text.replace(',', '.'));
  return Number(text);
}
