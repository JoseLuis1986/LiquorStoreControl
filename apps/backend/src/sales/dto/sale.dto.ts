import { PaymentMethod, SaleTrigger } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
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

  /** Unidades base. Obligatorio si no se vende por presentación. */
  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  quantityBase?: number;

  /** Presentación (caja, six, unidad). La cantidad va en `quantity`. */
  @IsOptional()
  @IsUUID()
  presentationId?: string;

  /** Cuántas presentaciones (1 caja) o, sin presentación, unidades. */
  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  /** TAKEAWAY se entrega ya. ON_PREMISE queda en la tarjeta. */
  @IsOptional()
  @IsIn(['TAKEAWAY', 'ON_PREMISE'])
  fulfillment?: 'TAKEAWAY' | 'ON_PREMISE';
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

  /** TAKEAWAY se lleva el producto. ON_PREMISE carga el saldo en la tarjeta. */
  @IsOptional()
  @IsIn(['TAKEAWAY', 'ON_PREMISE'])
  fulfillment?: 'TAKEAWAY' | 'ON_PREMISE';

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
