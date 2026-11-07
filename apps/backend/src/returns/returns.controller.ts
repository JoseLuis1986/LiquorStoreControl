import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserContext } from '../common/types/auth-user';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/return.dto';

const STAFF = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.EMPLOYEE,
] as const;

@Controller('returns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  @Roles(...STAFF)
  list(@CurrentUser() user: AuthUserContext) {
    return this.returns.list(user.tenantId);
  }

  @Get(':id')
  @Roles(...STAFF)
  get(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.returns.get(user.tenantId, id);
  }

  @Post()
  @Roles(...STAFF)
  create(@CurrentUser() user: AuthUserContext, @Body() dto: CreateReturnDto) {
    return this.returns.create(user.tenantId, user.id, dto);
  }
}
