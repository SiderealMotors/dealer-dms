import { CrmTaskStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCrmTaskDto {
  @IsString()
  @MinLength(1)
  customerId!: string;

  @IsOptional()
  @IsString()
  dealId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsEnum(CrmTaskStatus)
  status?: CrmTaskStatus;
}
