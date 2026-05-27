import { DealStage } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

const money = { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 };

export class UpdateDealDto {
  @IsOptional()
  @IsString()
  vehicleId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(money)
  @Min(0)
  @Max(99_999_999.99)
  value?: number | null;

  @IsOptional()
  @IsEnum(DealStage)
  stage?: DealStage;

  @IsOptional()
  @IsDateString()
  closedAt?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
