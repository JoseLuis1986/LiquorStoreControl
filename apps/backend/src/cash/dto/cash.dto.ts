import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class OpenCashSessionDto {
  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  openingFloat?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CloseCashSessionDto {
  @IsNumber()
  @Min(0)
  closingAmount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
