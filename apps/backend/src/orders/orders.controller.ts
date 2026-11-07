import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserContext } from '../common/types/auth-user';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/order.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE)
  list(@CurrentUser() user: AuthUserContext) {
    return this.orders.list(user.tenantId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  create(@CurrentUser() user: AuthUserContext, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.tenantId, dto);
  }

  @Post(':id/receive')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  receive(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.orders.receive(user.tenantId, user.id, id);
  }
}
