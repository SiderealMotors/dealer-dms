import { JournalStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListJournalEntriesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(JournalStatus)
  status?: JournalStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
