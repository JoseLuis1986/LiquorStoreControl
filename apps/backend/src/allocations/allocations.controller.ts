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
import { AllocationsService } from './allocations.service';
import { CreateAllocationDto } from './dto/allocation.dto';

const STAFF = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.EMPLOYEE,
] as const;

@Controller('allocations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AllocationsController {
  constructor(private readonly allocations: AllocationsService) {}

  @Get()
  @Roles(...STAFF)
  list(
    @CurrentUser() user: AuthUserContext,
    @Query('customerId') customerId?: string,
  ) {
    return this.allocations.list(user.tenantId, customerId);
  }

  @Post()
  @Roles(...STAFF)
  create(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: CreateAllocationDto,
  ) {
    return this.allocations.create(user.tenantId, user.id, dto);
  }

  @Post(':id/reverse')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  reverse(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.allocations.reverse(user.tenantId, user.id, id);
  }
}
