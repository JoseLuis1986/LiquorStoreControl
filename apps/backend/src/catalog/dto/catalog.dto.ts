import { ProductModality, UnitKind } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateUnitDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsEnum(UnitKind)
  kind?: UnitKind;
}

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;
}

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  sku!: string;

  @IsString()
  name!: string;

  @IsUUID()
  baseUnitId!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ProductModality)
  modality?: ProductModality;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultUnitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsEnum(ProductModality)
  modality?: ProductModality;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultUnitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;
}

export class CreatePresentationDto {
  @IsUUID()
  unitId!: string;

  @IsString()
  name!: string;

  @IsNumber()
  @Min(0.000001)
  factorToBase!: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  barcode?: string;
}
