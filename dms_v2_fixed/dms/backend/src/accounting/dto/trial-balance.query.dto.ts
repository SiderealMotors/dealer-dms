import { IsDateString, IsOptional } from 'class-validator';

export class TrialBalanceQueryDto {
  @IsOptional()
  @IsDateString()
  asOf?: string;
}
