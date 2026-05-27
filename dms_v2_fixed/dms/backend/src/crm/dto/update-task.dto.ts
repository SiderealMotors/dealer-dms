import { CrmTaskStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateCrmTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @IsOptional()
  @IsEnum(CrmTaskStatus)
  status?: CrmTaskStatus;

  @IsOptional()
  @IsDateString()
  completedAt?: string | null;
}
