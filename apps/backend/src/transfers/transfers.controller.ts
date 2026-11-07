import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserContext } from '../common/types/auth-user';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/transfer.dto';

@Controller('transfers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE)
  list(@CurrentUser() user: AuthUserContext) {
    return this.transfers.list(user.tenantId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  create(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: CreateTransferDto,
  ) {
    return this.transfers.create(user.tenantId, user.id, dto);
  }

  @Post(':id/complete')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  complete(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.transfers.complete(user.tenantId, user.id, id);
  }
}
