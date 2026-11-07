import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCategoryDto,
  CreatePresentationDto,
  CreateProductDto,
  CreateUnitDto,
  UpdateProductDto,
} from './dto/catalog.dto';
import { toDecimal } from '../common/utils/decimal';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Units ──────────────────────────────────────────────────────────────────
  listUnits(tenantId: string) {
    return this.prisma.unitOfMeasure.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });
  }

  async createUnit(tenantId: string, dto: CreateUnitDto) {
    try {
      return await this.prisma.unitOfMeasure.create({
        data: {
          tenantId,
          code: dto.code,
          name: dto.name,
          kind: dto.kind ?? 'COUNT',
        },
      });
    } catch {
      throw new ConflictException('Código de unidad duplicado');
    }
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  listCategories(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({
        data: { tenantId, name: dto.name, code: dto.code },
      });
    } catch {
      throw new ConflictException('Categoría duplicada');
    }
  }

  // ── Products ───────────────────────────────────────────────────────────────
  listProducts(tenantId: string) {
    return this.prisma.product.findMany({
      where: { tenantId },
      include: {
        baseUnit: true,
        category: true,
        presentations: { include: { unit: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getProduct(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        baseUnit: true,
        category: true,
        presentations: { include: { unit: true } },
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  async createProduct(tenantId: string, dto: CreateProductDto) {
    const unit = await this.prisma.unitOfMeasure.findFirst({
      where: { id: dto.baseUnitId, tenantId },
    });
    if (!unit) throw new NotFoundException('Unidad base no encontrada');
    try {
      const product = await this.prisma.product.create({
        data: {
          tenantId,
          sku: dto.sku,
          name: dto.name,
          baseUnitId: dto.baseUnitId,
          categoryId: dto.categoryId,
          modality: dto.modality ?? 'UNIT',
        },
      });
      // Presentación 1:1 por defecto
      await this.prisma.productPresentation.create({
        data: {
          tenantId,
          productId: product.id,
          unitId: dto.baseUnitId,
          name: unit.name,
          factorToBase: toDecimal(1),
          isDefault: true,
        },
      });
      return this.getProduct(tenantId, product.id);
    } catch {
      throw new ConflictException('SKU duplicado');
    }
  }

  async updateProduct(tenantId: string, id: string, dto: UpdateProductDto) {
    await this.getProduct(tenantId, id);
    await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        categoryId: dto.categoryId === undefined ? undefined : dto.categoryId,
        modality: dto.modality,
        active: dto.active,
      },
    });
    return this.getProduct(tenantId, id);
  }

  async addPresentation(
    tenantId: string,
    productId: string,
    dto: CreatePresentationDto,
  ) {
    await this.getProduct(tenantId, productId);
    const unit = await this.prisma.unitOfMeasure.findFirst({
      where: { id: dto.unitId, tenantId },
    });
    if (!unit) throw new NotFoundException('Unidad no encontrada');
    if (dto.isDefault) {
      await this.prisma.productPresentation.updateMany({
        where: { tenantId, productId },
        data: { isDefault: false },
      });
    }
    return this.prisma.productPresentation.create({
      data: {
        tenantId,
        productId,
        unitId: dto.unitId,
        name: dto.name,
        factorToBase: toDecimal(dto.factorToBase),
        isDefault: dto.isDefault ?? false,
        barcode: dto.barcode,
      },
      include: { unit: true },
    });
  }

  listPresentations(tenantId: string, productId: string) {
    return this.prisma.productPresentation.findMany({
      where: { tenantId, productId },
      include: { unit: true },
      orderBy: { name: 'asc' },
    });
  }
}
