import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class AdjustInventoryDto {
  @IsUUID()
  warehouseId!: string;

  @IsUUID()
  productId!: string;

  /** Signed delta in base units (positive = in, negative = out). */
  @IsNumber()
  quantityBase!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class InitialStockDto {
  @IsUUID()
  warehouseId!: string;

  @IsUUID()
  productId!: string;

  @IsNumber()
  @Min(0.000001)
  quantityBase!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
