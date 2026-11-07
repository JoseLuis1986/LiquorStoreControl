import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserContext } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE)
  list(@CurrentUser() user: AuthUserContext) {
    return this.prisma.sale.findMany({
      where: { tenantId: user.tenantId },
      include: {
        customer: true,
        lines: { include: { product: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
