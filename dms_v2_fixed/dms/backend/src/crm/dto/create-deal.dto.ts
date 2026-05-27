import { DealStage } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

const money = { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 };

export class CreateDealDto {
  @IsString()
  @MinLength(1)
  customerId!: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(money)
  @Min(0)
  @Max(99_999_999.99)
  value?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(DealStage)
  stage?: DealStage;
}
