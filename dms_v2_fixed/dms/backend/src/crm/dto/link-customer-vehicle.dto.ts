import { CustomerVehicleRole } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class LinkCustomerVehicleDto {
  @IsString()
  @MinLength(1)
  vehicleId!: string;

  @IsOptional()
  @IsEnum(CustomerVehicleRole)
  role?: CustomerVehicleRole;
}
