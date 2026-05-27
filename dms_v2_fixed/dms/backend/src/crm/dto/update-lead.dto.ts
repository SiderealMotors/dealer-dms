import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Allow, IsOptional, IsString, ValidateIf } from 'class-validator';
import { CreateLeadDto } from './create-lead.dto';

export class UpdateLeadDto extends PartialType(OmitType(CreateLeadDto, ['vehicleId'] as const)) {
  /** Set to `null` to clear the vehicle link. */
  @Allow()
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  vehicleId?: string | null;
}
