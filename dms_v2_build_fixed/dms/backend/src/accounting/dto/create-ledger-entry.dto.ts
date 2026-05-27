import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateLedgerEntryDto {
  @IsString()
  vehicleId!: string;

  @IsString()
  category!: string;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  occurredOn!: string;
}
