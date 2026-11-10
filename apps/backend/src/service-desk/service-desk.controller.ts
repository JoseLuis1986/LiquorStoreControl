import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserContext } from '../common/types/auth-user';
import { ServiceDeskService } from './service-desk.service';
import { CreateVisitDto } from './dto/visit.dto';

const STAFF = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.EMPLOYEE,
] as const;

@Controller('service')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceDeskController {
  constructor(private readonly desk: ServiceDeskService) {}

  @Get('active')
  @Roles(...STAFF)
  active(@CurrentUser() user: AuthUserContext) {
    return this.desk.active(user.tenantId);
  }

  @Get('my-dispatches')
  @Roles(...STAFF)
  mine(@CurrentUser() user: AuthUserContext) {
    return this.desk.myDispatches(user.tenantId, user.id);
  }

  @Post('visits')
  @Roles(...STAFF)
  visit(@CurrentUser() user: AuthUserContext, @Body() dto: CreateVisitDto) {
    return this.desk.visit(user.tenantId, user.id, dto.customerId);
  }
}
