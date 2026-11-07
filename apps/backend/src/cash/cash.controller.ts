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
import { CashService } from './cash.service';
import { CloseCashSessionDto, OpenCashSessionDto } from './dto/cash.dto';

const STAFF = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.EMPLOYEE,
] as const;

@Controller('cash-sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get()
  @Roles(...STAFF)
  list(@CurrentUser() user: AuthUserContext) {
    return this.cash.list(user.tenantId);
  }

  @Get('current')
  @Roles(...STAFF)
  async current(
    @CurrentUser() user: AuthUserContext,
    @Query('warehouseId') warehouseId?: string,
  ) {
    const session = await this.cash.currentOpen(user.tenantId, warehouseId);
    return { session };
  }

  @Get(':id/summary')
  @Roles(...STAFF)
  summary(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.cash.summary(user.tenantId, id);
  }

  @Post('open')
  @Roles(...STAFF)
  open(@CurrentUser() user: AuthUserContext, @Body() dto: OpenCashSessionDto) {
    return this.cash.open(user.tenantId, user.id, dto);
  }

  @Post(':id/close')
  @Roles(...STAFF)
  close(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Body() dto: CloseCashSessionDto,
  ) {
    return this.cash.close(user.tenantId, user.id, id, dto);
  }
}
