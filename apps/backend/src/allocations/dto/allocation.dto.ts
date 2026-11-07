import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class AllocationLineDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsUUID()
  presentationId?: string;

  /** Cantidad en la presentación (si hay) o en unidad base. */
  @IsNumber()
  @Min(0.000001)
  quantity!: number;
}

export class CreateAllocationDto {
  @IsUUID()
  customerId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AllocationLineDto)
  lines!: AllocationLineDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
