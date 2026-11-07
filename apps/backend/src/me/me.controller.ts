import {
  Controller,
  ForbiddenException,
  Get,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserContext } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';

@Controller('me')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('consumptions')
  @Roles(UserRole.CUSTOMER)
  async consumptions(@CurrentUser() user: AuthUserContext) {
    if (!user.customerId) {
      throw new ForbiddenException('Usuario sin cliente vinculado');
    }
    return this.prisma.consumption.findMany({
      where: { tenantId: user.tenantId, customerId: user.customerId },
      include: {
        lines: { include: { product: true } },
        warehouse: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get('allocation-balances')
  @Roles(UserRole.CUSTOMER)
  async balances(@CurrentUser() user: AuthUserContext) {
    if (!user.customerId) {
      throw new ForbiddenException('Usuario sin cliente vinculado');
    }
    return this.prisma.customerAllocationBalance.findMany({
      where: { tenantId: user.tenantId, customerId: user.customerId },
      include: { product: true, warehouse: true },
    });
  }
}
