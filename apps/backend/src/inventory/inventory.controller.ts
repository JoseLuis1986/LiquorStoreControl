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
import { InventoryService } from './inventory.service';
import { AdjustInventoryDto, InitialStockDto } from './dto/inventory.dto';

const STAFF = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.EMPLOYEE,
] as const;

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('balances')
  @Roles(...STAFF)
  balances(
    @CurrentUser() user: AuthUserContext,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.inventory.listBalances(user.tenantId, warehouseId);
  }

  @Get('movements')
  @Roles(...STAFF)
  movements(
    @CurrentUser() user: AuthUserContext,
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string,
  ) {
    return this.inventory.listMovements(user.tenantId, {
      warehouseId,
      productId,
    });
  }

  @Post('initial-stock')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  initial(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: InitialStockDto,
  ) {
    return this.inventory.initialStock(user.tenantId, user.id, dto);
  }

  @Post('adjustments')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  adjust(@CurrentUser() user: AuthUserContext, @Body() dto: AdjustInventoryDto) {
    return this.inventory.adjust(user.tenantId, user.id, dto);
  }

  @Post('movements/:id/reverse')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  reverse(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.inventory.reverseMovement(user.tenantId, user.id, id);
  }
}
