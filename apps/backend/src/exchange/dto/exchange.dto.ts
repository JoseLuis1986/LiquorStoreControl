import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateExchangeDto {
  @IsIn(['MANUAL', 'AUTOMATIC'])
  mode!: 'MANUAL' | 'AUTOMATIC';

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  usdToVes?: number;
}
