import { IsUUID } from 'class-validator';

export class CreateVisitDto {
  @IsUUID()
  customerId!: string;
}
