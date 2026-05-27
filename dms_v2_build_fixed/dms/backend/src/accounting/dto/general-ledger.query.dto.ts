import { IsDateString, IsOptional, IsString } from 'class-validator';

export class GeneralLedgerQueryDto {
  @IsString()
  accountId!: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
