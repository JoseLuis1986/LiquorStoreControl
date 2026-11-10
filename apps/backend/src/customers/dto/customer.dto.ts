import { CustomerStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

const BILLING = ['CHARGE_ON_ALLOCATION', 'CHARGE_ON_CONSUMPTION'] as const;

export class CreateCustomerDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(BILLING, { each: true })
  billingModes?: string[];
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;
}

export class UpdateBillingModesDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(BILLING, { each: true })
  billingModes!: string[];
}
