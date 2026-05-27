import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

const MAX_MONEY = 99_999_999.99;

const numberOpts = {
  allowNaN: false,
  allowInfinity: false,
  maxDecimalPlaces: 2,
};

export class CreateVehicleDto {
  @IsDateString({}, { message: 'datePurchased must be a valid ISO date (YYYY-MM-DD)' })
  datePurchased!: string;

  @IsString()
  @Matches(VIN_REGEX, { message: 'VIN must be 17 valid characters (no I, O, or Q)' })
  vin!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1980)
  @Max(new Date().getFullYear() + 1)
  year!: number;

  @IsString()
  @IsNotEmpty({ message: 'make is required' })
  make!: string;

  @IsString()
  @IsNotEmpty({ message: 'model is required' })
  model!: string;

  @IsString()
  @IsNotEmpty({ message: 'trim is required' })
  trim!: string;

  @IsString()
  @IsNotEmpty({ message: 'colour is required' })
  colour!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  odometer!: number;

  @Type(() => Number)
  @IsNumber(numberOpts, { message: 'purchasePrice must be a finite number with at most 2 decimal places' })
  @Min(0)
  @Max(MAX_MONEY)
  purchasePrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(numberOpts)
  @Min(0)
  @Max(MAX_MONEY)
  safetyEstimate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(numberOpts)
  @Min(0)
  @Max(MAX_MONEY)
  safetyCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(numberOpts)
  @Min(0)
  @Max(MAX_MONEY)
  floorplanInterestCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(numberOpts)
  @Min(0)
  @Max(MAX_MONEY)
  gas?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(numberOpts)
  @Min(0)
  @Max(MAX_MONEY)
  warrantyCost?: number;

  /**
   * When `dateSold` is set, the vehicle is **Sold**; this field is ignored and status becomes SOLD.
   * When unsold, use `status` to choose Available vs Pending.
   */
  @IsOptional()
  @IsDateString({}, { message: 'dateSold must be a valid ISO date (YYYY-MM-DD)' })
  dateSold?: string;

  /** Ignored if `dateSold` is provided (server forces SOLD). */
  @IsOptional()
  @IsIn(['available', 'pending'], { message: 'status must be available or pending' })
  status?: 'available' | 'pending';

  @IsOptional()
  @Type(() => Number)
  @IsNumber(numberOpts)
  @Min(0)
  @Max(MAX_MONEY)
  sellingPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(numberOpts)
  @Min(0)
  @Max(MAX_MONEY)
  safetyCharge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(numberOpts)
  @Min(0)
  @Max(MAX_MONEY)
  warrantyCharge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(numberOpts)
  @Min(0)
  @Max(MAX_MONEY)
  omvicFee?: number;

  @IsOptional()
  @IsString()
  buyerName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(numberOpts)
  @Min(0)
  @Max(MAX_MONEY)
  referralAmount?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(numberOpts)
  @Min(0)
  @Max(MAX_MONEY)
  depositAmount?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  salesPersonId?: string;

  @IsOptional()
  @IsString()
  salesPersonName?: string;
}
