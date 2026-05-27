import { IsIn, IsOptional, IsDateString } from 'class-validator';

export class BalanceSheetQueryDto {
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @IsOptional()
  @IsIn(['csv', 'json'])
  format?: 'csv' | 'json';
}
