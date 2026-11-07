import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserContext } from '../common/types/auth-user';
import { SalesService } from './sales.service';
import {
  CreateManualSaleDto,
  RecordPaymentDto,
  SetCustomerPriceDto,
} from './dto/sale.dto';

const STAFF = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.EMPLOYEE,
] as const;

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get('sales')
  @Roles(...STAFF)
  list(
    @CurrentUser() user: AuthUserContext,
    @Query('status') status?: string,
    @Query('arOnly') arOnly?: string,
  ) {
    return this.sales.list(user.tenantId, {
      status,
      arOnly: arOnly === 'true' || arOnly === '1',
    });
  }

  @Get('sales/:id')
  @Roles(...STAFF)
  get(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.sales.get(user.tenantId, id);
  }

  @Post('sales')
  @Roles(...STAFF)
  create(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: CreateManualSaleDto,
  ) {
    return this.sales.createManual(user.tenantId, user.id, dto);
  }

  @Post('sales/:id/payments')
  @Roles(...STAFF)
  pay(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.sales.recordPayment(user.tenantId, user.id, id, dto);
  }

  @Get('customer-prices')
  @Roles(...STAFF)
  prices(
    @CurrentUser() user: AuthUserContext,
    @Query('customerId') customerId?: string,
  ) {
    return this.sales.listCustomerPrices(user.tenantId, customerId);
  }

  @Post('customer-prices')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  setPrice(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: SetCustomerPriceDto,
  ) {
    return this.sales.setCustomerPrice(user.tenantId, dto);
  }
}
