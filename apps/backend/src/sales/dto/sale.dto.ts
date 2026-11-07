import { PaymentMethod, SaleTrigger } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ManualSaleLineDto {
  @IsUUID()
  productId!: string;

  @IsNumber()
  @Min(0.000001)
  quantityBase!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class CreateManualSaleDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsUUID()
  cashSessionId?: string;

  @IsOptional()
  @IsEnum(SaleTrigger)
  trigger?: SaleTrigger;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ManualSaleLineDto)
  lines!: ManualSaleLineDto[];

  /** Si se envía, registra pago inmediato. */
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paymentAmount?: number;
}

export class RecordPaymentDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsUUID()
  cashSessionId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SetCustomerPriceDto {
  @IsUUID()
  customerId!: string;

  @IsUUID()
  productId!: string;

  @IsNumber()
  @Min(0)
  unitPrice!: number;
}
