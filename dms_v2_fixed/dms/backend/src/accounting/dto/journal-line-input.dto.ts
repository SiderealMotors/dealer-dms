import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const money = { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 };

export class JournalLineInputDto {
  @IsString()
  accountId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(money)
  @Min(0)
  @Max(99_999_999_999.99)
  debitAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(money)
  @Min(0)
  @Max(99_999_999_999.99)
  creditAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  memo?: string;
}
