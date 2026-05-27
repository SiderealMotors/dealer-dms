import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MAX_VEHICLE_LIST_LIMIT } from '../../../common/dto/pagination-query.dto';

export enum VehicleStatusFilter {
  AVAILABLE = 'available',
  PENDING = 'pending',
  SOLD = 'sold',
}

export class ListVehiclesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_VEHICLE_LIST_LIMIT)
  limit?: number;

  @IsOptional()
  @IsEnum(VehicleStatusFilter)
  status?: VehicleStatusFilter;

  @IsOptional()
  @IsString()
  salesPersonId?: string;
}
