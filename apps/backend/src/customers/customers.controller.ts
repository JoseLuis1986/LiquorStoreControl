import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserContext } from '../common/types/auth-user';
import { CustomersService } from './customers.service';
import {
  CreateCustomerDto,
  UpdateBillingModesDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

const STAFF = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.EMPLOYEE,
] as const;

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @Roles(...STAFF)
  list(@CurrentUser() user: AuthUserContext) {
    return this.customers.list(user.tenantId);
  }

  @Get(':id')
  @Roles(...STAFF)
  get(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.customers.get(user.tenantId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  create(@CurrentUser() user: AuthUserContext, @Body() dto: CreateCustomerDto) {
    return this.customers.create(user.tenantId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  update(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(user.tenantId, id, dto);
  }

  @Patch(':id/billing-modes')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  billing(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Body() dto: UpdateBillingModesDto,
  ) {
    return this.customers.updateBilling(user.tenantId, id, dto);
  }

  @Get(':id/allocation-balances')
  @Roles(...STAFF)
  balances(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.customers.allocationBalances(user.tenantId, id);
  }
}
