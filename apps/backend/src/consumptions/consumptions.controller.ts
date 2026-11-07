import {
  Body,
  Controller,
  Get,
  Headers,
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
import { ConsumptionsService } from './consumptions.service';
import { CreateConsumptionDto } from './dto/consumption.dto';

const STAFF = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.EMPLOYEE,
] as const;

@Controller('consumptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConsumptionsController {
  constructor(private readonly consumptions: ConsumptionsService) {}

  @Get()
  @Roles(...STAFF)
  list(
    @CurrentUser() user: AuthUserContext,
    @Query('customerId') customerId?: string,
  ) {
    return this.consumptions.list(user.tenantId, { customerId });
  }

  @Post()
  @Roles(...STAFF)
  async create(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: CreateConsumptionDto,
    @Headers('idempotency-key') idemHeader?: string,
  ) {
    const key = idemHeader?.trim() || dto.idempotencyKey?.trim();
    const result = await this.consumptions.create(
      user.tenantId,
      user.id,
      dto,
      key ?? '',
    );
    return result;
  }
}
