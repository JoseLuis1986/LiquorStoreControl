import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserContext } from '../common/types/auth-user';
import { ReceiptsService } from './receipts.service';

const STAFF = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.EMPLOYEE,
] as const;

@Controller('receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  @Get('sales/:id')
  @Roles(...STAFF)
  @Header('Content-Type', 'text/html; charset=utf-8')
  sale(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.receipts.saleHtml(user.tenantId, id);
  }

  @Get('payments/:id')
  @Roles(...STAFF)
  @Header('Content-Type', 'text/html; charset=utf-8')
  payment(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.receipts.paymentHtml(user.tenantId, id);
  }

  @Get('returns/:id')
  @Roles(...STAFF)
  @Header('Content-Type', 'text/html; charset=utf-8')
  ret(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.receipts.returnHtml(user.tenantId, id);
  }
}
