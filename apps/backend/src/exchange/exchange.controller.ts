import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserContext } from '../common/types/auth-user';
import { ExchangeService } from './exchange.service';
import { UpdateExchangeDto } from './dto/exchange.dto';

const STAFF = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.EMPLOYEE,
] as const;
const OFFICE = [UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER] as const;

@Controller('exchange-rate')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExchangeController {
  constructor(private readonly exchange: ExchangeService) {}

  @Get()
  @Roles(...STAFF)
  current(@CurrentUser() user: AuthUserContext) {
    return this.exchange.current(user.tenantId);
  }

  @Patch()
  @Roles(...OFFICE)
  update(@CurrentUser() user: AuthUserContext, @Body() dto: UpdateExchangeDto) {
    return this.exchange.update(user.tenantId, dto);
  }

  @Post('refresh')
  @Roles(...OFFICE)
  refresh(@CurrentUser() user: AuthUserContext) {
    return this.exchange.refresh(user.tenantId);
  }
}
