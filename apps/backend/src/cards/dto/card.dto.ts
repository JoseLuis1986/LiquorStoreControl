import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class IssueCardDto {
  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class ResolveCardDto {
  @IsString()
  @MinLength(8)
  token!: string;
}
