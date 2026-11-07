import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomerDto,
  UpdateBillingModesDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.customer.findMany({
      where: { tenantId },
      include: {
        cards: {
          select: { id: true, status: true, label: true, issuedAt: true },
          orderBy: { issuedAt: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async get(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        cards: true,
        allocationBalances: { include: { product: true, warehouse: true } },
      },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  async create(tenantId: string, dto: CreateCustomerDto) {
    try {
      return await this.prisma.customer.create({
        data: {
          tenantId,
          code: dto.code,
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          billingModes: dto.billingModes ?? ['CHARGE_ON_ALLOCATION'],
        },
      });
    } catch {
      throw new ConflictException('Código de cliente duplicado');
    }
  }

  async update(tenantId: string, id: string, dto: UpdateCustomerDto) {
    await this.ensure(tenantId, id);
    return this.prisma.customer.update({
      where: { id },
      data: dto,
    });
  }

  async updateBilling(tenantId: string, id: string, dto: UpdateBillingModesDto) {
    await this.ensure(tenantId, id);
    return this.prisma.customer.update({
      where: { id },
      data: { billingModes: dto.billingModes },
    });
  }

  async allocationBalances(tenantId: string, customerId: string) {
    await this.ensure(tenantId, customerId);
    return this.prisma.customerAllocationBalance.findMany({
      where: { tenantId, customerId },
      include: { product: true, warehouse: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async ensure(tenantId: string, id: string) {
    const c = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return c;
  }
}
