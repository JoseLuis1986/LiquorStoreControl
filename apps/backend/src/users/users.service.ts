import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        customerId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const exists = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (exists) throw new ConflictException('Email ya registrado en el tenant');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        customerId: dto.customerId,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        customerId: true,
        createdAt: true,
      },
    });
  }
}
