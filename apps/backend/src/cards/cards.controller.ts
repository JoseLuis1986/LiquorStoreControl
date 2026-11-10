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
import { CardsService } from './cards.service';
import { IssueCardDto, ResolveCardDto } from './dto/card.dto';

const STAFF = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.EMPLOYEE,
] as const;

@Controller('cards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  @Roles(...STAFF)
  list(
    @CurrentUser() user: AuthUserContext,
    @Query('customerId') customerId?: string,
  ) {
    return this.cards.list(user.tenantId, customerId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE)
  issue(@CurrentUser() user: AuthUserContext, @Body() dto: IssueCardDto) {
    return this.cards.issue(user.tenantId, dto);
  }

  @Get(':id/artwork')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  artwork(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.cards.artwork(user.tenantId, id);
  }

  @Post('resolve')
  @Roles(...STAFF)
  resolve(@CurrentUser() user: AuthUserContext, @Body() dto: ResolveCardDto) {
    return this.cards.resolve(user.tenantId, dto.token);
  }

  @Post(':id/revoke')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  revoke(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.cards.revoke(user.tenantId, id);
  }

  @Post(':id/replace')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  replace(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.cards.replace(user.tenantId, id);
  }
}
