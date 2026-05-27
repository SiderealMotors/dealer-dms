import { IsIn, IsOptional, IsDateString } from 'class-validator';

export class IncomeStatementQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(['csv', 'json'])
  format?: 'csv' | 'json';
}
