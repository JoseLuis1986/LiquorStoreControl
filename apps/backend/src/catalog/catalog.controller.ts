import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserContext } from '../common/types/auth-user';
import { CatalogService } from './catalog.service';
import {
  CreateCategoryDto,
  CreatePresentationDto,
  CreateProductDto,
  CreateUnitDto,
  UpdateProductDto,
} from './dto/catalog.dto';

const STAFF = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.EMPLOYEE,
] as const;

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('units')
  @Roles(...STAFF)
  listUnits(@CurrentUser() user: AuthUserContext) {
    return this.catalog.listUnits(user.tenantId);
  }

  @Post('units')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  createUnit(@CurrentUser() user: AuthUserContext, @Body() dto: CreateUnitDto) {
    return this.catalog.createUnit(user.tenantId, dto);
  }

  @Get('categories')
  @Roles(...STAFF)
  listCategories(@CurrentUser() user: AuthUserContext) {
    return this.catalog.listCategories(user.tenantId);
  }

  @Post('categories')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  createCategory(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.catalog.createCategory(user.tenantId, dto);
  }

  @Get('products')
  @Roles(...STAFF)
  listProducts(@CurrentUser() user: AuthUserContext) {
    return this.catalog.listProducts(user.tenantId);
  }

  @Get('products/:id')
  @Roles(...STAFF)
  getProduct(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.catalog.getProduct(user.tenantId, id);
  }

  @Post('products')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  createProduct(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: CreateProductDto,
  ) {
    return this.catalog.createProduct(user.tenantId, dto);
  }

  @Patch('products/:id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  updateProduct(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(user.tenantId, id, dto);
  }

  @Get('products/:id/presentations')
  @Roles(...STAFF)
  listPresentations(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
  ) {
    return this.catalog.listPresentations(user.tenantId, id);
  }

  @Post('products/:id/presentations')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  addPresentation(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Body() dto: CreatePresentationDto,
  ) {
    return this.catalog.addPresentation(user.tenantId, id, dto);
  }
}
