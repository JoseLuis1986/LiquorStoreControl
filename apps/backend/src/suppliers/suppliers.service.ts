import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.supplier.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateSupplierDto) {
    try {
      return await this.prisma.supplier.create({
        data: {
          tenantId,
          code: dto.code,
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          taxId: dto.taxId,
        },
      });
    } catch {
      throw new ConflictException('Código de proveedor duplicado');
    }
  }

  async update(tenantId: string, id: string, dto: UpdateSupplierDto) {
    const s = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!s) throw new NotFoundException('Proveedor no encontrado');
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }
}
