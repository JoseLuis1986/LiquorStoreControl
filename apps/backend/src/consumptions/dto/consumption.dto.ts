import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ConsumptionLineDto {
  @IsUUID()
  productId!: string;

  @IsNumber()
  @Min(0.000001)
  quantityBase!: number;
}

export class CreateConsumptionDto {
  @IsUUID()
  customerId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConsumptionLineDto)
  lines!: ConsumptionLineDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  /** También se acepta por header Idempotency-Key. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  idempotencyKey?: string;
}
