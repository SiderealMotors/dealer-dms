import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ExpenseCategory } from '@prisma/client';

export class CreateExpenseDto {
  @IsDateString()
  date: string;

  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  amountPreTax: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hstAmount?: number;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @IsOptional()
  @IsString()
  glAccountId?: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;
}
