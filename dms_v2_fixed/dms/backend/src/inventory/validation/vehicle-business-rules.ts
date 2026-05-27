import { BadRequestException } from '@nestjs/common';
import type { Vehicle } from '@prisma/client';
import {
  computeVehicleProfitFromCents,
  decimalLikeToCents,
  decimalLikeToCentsOrNull,
  finiteMoneyNumberToCents,
  type ComputeVehicleProfitResult,
  type VehicleProfitCentsInput,
} from '../../lib/inventory-calculations';
import type { UpdateVehicleDto } from '../vehicles/dto/update-vehicle.dto';

/** All inventory taxes use this rate (13%). */
export const INVENTORY_TAX_RATE_LABEL = '13%';

const MAX_VEHICLE_MONEY = 99_999_999.99;

export function profitFailureMessage(result: Extract<ComputeVehicleProfitResult, { success: false }>): string {
  switch (result.code) {
    case 'MISSING_SALE_LINE':
      return `Sale is incomplete: "${result.field}" is required when a sale date is set (use 0 if none).`;
    case 'NON_FINITE_INPUT':
      return `Invalid amount for "${result.field}": must be a finite number (not NaN or Infinity).`;
    case 'NEGATIVE_AMOUNT':
      return `"${result.field}" cannot be negative.`;
    default:
      return 'Invalid vehicle financial data.';
  }
}

/** Strict YYYY-MM-DD calendar check (rejects 2025-02-31, etc.). */
export function assertValidCalendarYmd(label: string, value: string | undefined | null): void {
  if (value == null || String(value).trim() === '') {
    throw new BadRequestException(`${label} is required.`);
  }
  const s = String(value).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    throw new BadRequestException(`${label} must be a valid date in YYYY-MM-DD format.`);
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw new BadRequestException(`${label} is not a valid calendar date.`);
  }
}

/** ISO date strings compare lexicographically for same-length YYYY-MM-DD. */
export function assertDateSoldNotBeforePurchased(datePurchasedYmd: string, dateSoldYmd: string): void {
  if (dateSoldYmd < datePurchasedYmd) {
    throw new BadRequestException(
      'dateSold cannot be earlier than datePurchased.',
    );
  }
}

export function assertFiniteNonNegativeMoney(label: string, value: number | undefined | null): void {
  if (value === undefined || value === null) {
    throw new BadRequestException(`${label} is required.`);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BadRequestException(`${label} must be a finite number.`);
  }
  if (value < 0) {
    throw new BadRequestException(`${label} cannot be negative.`);
  }
  if (value > MAX_VEHICLE_MONEY) {
    throw new BadRequestException(`${label} exceeds the maximum allowed amount.`);
  }
}

export function assertOptionalFiniteNonNegativeMoney(
  label: string,
  value: number | undefined | null,
): void {
  if (value === undefined || value === null) {
    return;
  }
  assertFiniteNonNegativeMoney(label, value);
}

export function assertNonNegativeCents(label: string, value: bigint): void {
  if (value < 0n) {
    throw new BadRequestException(`"${label}" cannot be negative.`);
  }
}

function formatExistingDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Shape needed for create validation (kept local to avoid circular imports with DTO decorators). */
export type VehicleCreateFinancialPayload = {
  datePurchased: string;
  dateSold?: string;
  purchasePrice: number;
  safetyEstimate?: number;
  safetyCost?: number;
  gas?: number;
  warrantyCost?: number;
  floorplanInterestCost?: number;
  referralAmount?: number;
  sellingPrice?: number;
  safetyCharge?: number;
  warrantyCharge?: number;
  omvicFee?: number;
};

/**
 * Maps create DTO + defaults into the profit engine input (integer cents). Throws on invalid data.
 */
export function buildProfitCentsInputFromCreate(dto: VehicleCreateFinancialPayload): VehicleProfitCentsInput {
  const n = finiteMoneyNumberToCents;
  assertFiniteNonNegativeMoney('purchasePrice', dto.purchasePrice);
  assertFiniteNonNegativeMoney('safetyCost', dto.safetyCost ?? 0);
  assertFiniteNonNegativeMoney('gas', dto.gas ?? 0);
  assertFiniteNonNegativeMoney('warrantyCost', dto.warrantyCost ?? 0);
  assertFiniteNonNegativeMoney('floorplanInterestCost', dto.floorplanInterestCost ?? 0);
  assertFiniteNonNegativeMoney('referralAmount', dto.referralAmount ?? 0);
  assertOptionalFiniteNonNegativeMoney('safetyEstimate', dto.safetyEstimate);

  if (!dto.dateSold) {
    return {
      purchasePriceCents: n(dto.purchasePrice),
      safetyCostCents: n(dto.safetyCost ?? 0),
      gasCents: n(dto.gas ?? 0),
      warrantyCostCents: n(dto.warrantyCost ?? 0),
      floorplanInterestCents: n(dto.floorplanInterestCost ?? 0),
      referralCents: n(dto.referralAmount ?? 0),
      sellingPriceCents: null,
      safetyChargeCents: null,
      warrantyChargeCents: null,
      omvicFeeCents: null,
    };
  }

  assertFiniteNonNegativeMoney('sellingPrice', dto.sellingPrice);
  assertFiniteNonNegativeMoney('safetyCharge', dto.safetyCharge);
  assertFiniteNonNegativeMoney('warrantyCharge', dto.warrantyCharge);
  assertFiniteNonNegativeMoney('omvicFee', dto.omvicFee);

  return {
    purchasePriceCents: n(dto.purchasePrice),
    safetyCostCents: n(dto.safetyCost ?? 0),
    gasCents: n(dto.gas ?? 0),
    warrantyCostCents: n(dto.warrantyCost ?? 0),
    floorplanInterestCents: n(dto.floorplanInterestCost ?? 0),
    referralCents: n(dto.referralAmount ?? 0),
    sellingPriceCents: n(dto.sellingPrice!),
    safetyChargeCents: n(dto.safetyCharge!),
    warrantyChargeCents: n(dto.warrantyCharge!),
    omvicFeeCents: n(dto.omvicFee!),
  };
}

/**
 * Full business validation for create (also invoked from `VehiclesService.create` after DTO field validation).
 */
export function validateCreateVehicleBusinessRules(dto: VehicleCreateFinancialPayload): void {
  assertValidCalendarYmd('datePurchased', dto.datePurchased);
  if (dto.dateSold) {
    assertValidCalendarYmd('dateSold', dto.dateSold);
    assertDateSoldNotBeforePurchased(
      String(dto.datePurchased).trim(),
      String(dto.dateSold).trim(),
    );
  }

  const nums = buildProfitCentsInputFromCreate(dto);
  if (dto.dateSold) {
    const result = computeVehicleProfitFromCents(nums);
    if (!result.success) {
      throw new BadRequestException(profitFailureMessage(result));
    }
  }
}

export function mergeUpdateForValidation(
  existing: Vehicle,
  dto: UpdateVehicleDto,
): {
  datePurchased: string;
  dateSold: string | null;
  profitCentsNums: VehicleProfitCentsInput;
} {
  const datePurchased =
    dto.datePurchased !== undefined
      ? String(dto.datePurchased).trim()
      : formatExistingDate(existing.datePurchased);

  let dateSold: string | null;
  if (dto.dateSold !== undefined) {
    dateSold = dto.dateSold && String(dto.dateSold).trim().length > 0 ? String(dto.dateSold).trim() : null;
  } else {
    dateSold = existing.dateSold ? formatExistingDate(existing.dateSold) : null;
  }

  const purchasePriceCents =
    dto.purchasePrice !== undefined
      ? finiteMoneyNumberToCents(dto.purchasePrice)
      : decimalLikeToCents(existing.purchasePrice);
  const safetyCostCents =
    dto.safetyCost !== undefined ? finiteMoneyNumberToCents(dto.safetyCost) : decimalLikeToCents(existing.safetyCost);
  const gasCents = dto.gas !== undefined ? finiteMoneyNumberToCents(dto.gas) : decimalLikeToCents(existing.gas);
  const warrantyCostCents =
    dto.warrantyCost !== undefined
      ? finiteMoneyNumberToCents(dto.warrantyCost)
      : decimalLikeToCents(existing.warrantyCost);
  const floorplanInterestCents =
    dto.floorplanInterestCost !== undefined
      ? finiteMoneyNumberToCents(dto.floorplanInterestCost)
      : decimalLikeToCents(existing.floorplanInterestCost);
  const referralCents =
    dto.referralAmount !== undefined
      ? finiteMoneyNumberToCents(dto.referralAmount)
      : decimalLikeToCents(existing.referralAmount);

  const sellingPriceCents =
    dto.sellingPrice !== undefined
      ? dto.sellingPrice === null
        ? null
        : finiteMoneyNumberToCents(dto.sellingPrice)
      : decimalLikeToCentsOrNull(existing.sellingPrice);
  const safetyChargeCents =
    dto.safetyCharge !== undefined
      ? dto.safetyCharge === null
        ? null
        : finiteMoneyNumberToCents(dto.safetyCharge)
      : decimalLikeToCentsOrNull(existing.safetyCharge);
  const warrantyChargeCents =
    dto.warrantyCharge !== undefined
      ? dto.warrantyCharge === null
        ? null
        : finiteMoneyNumberToCents(dto.warrantyCharge)
      : decimalLikeToCentsOrNull(existing.warrantyCharge);
  const omvicFeeCents =
    dto.omvicFee !== undefined
      ? dto.omvicFee === null
        ? null
        : finiteMoneyNumberToCents(dto.omvicFee)
      : decimalLikeToCentsOrNull(existing.omvicFee);

  const profitCentsNums: VehicleProfitCentsInput = {
    purchasePriceCents,
    safetyCostCents,
    gasCents,
    warrantyCostCents,
    floorplanInterestCents,
    referralCents,
    sellingPriceCents,
    safetyChargeCents,
    warrantyChargeCents,
    omvicFeeCents,
  };

  return { datePurchased, dateSold, profitCentsNums };
}

/**
 * Validates merged update state: dates, non-negative money, sale bundle + profit engine.
 */
export function validateUpdateVehicleBusinessRules(existing: Vehicle, dto: UpdateVehicleDto): void {
  const { datePurchased, dateSold, profitCentsNums } = mergeUpdateForValidation(existing, dto);

  assertValidCalendarYmd('datePurchased', datePurchased);

  if (dateSold) {
    assertValidCalendarYmd('dateSold', dateSold);
    assertDateSoldNotBeforePurchased(datePurchased, dateSold);
  }

  assertNonNegativeCents('purchasePrice', profitCentsNums.purchasePriceCents);
  assertNonNegativeCents('safetyCost', profitCentsNums.safetyCostCents);
  assertNonNegativeCents('gas', profitCentsNums.gasCents);
  assertNonNegativeCents('warrantyCost', profitCentsNums.warrantyCostCents);
  assertNonNegativeCents('floorplanInterestCost', profitCentsNums.floorplanInterestCents);
  assertNonNegativeCents('referralAmount', profitCentsNums.referralCents);

  if (dateSold) {
    const result = computeVehicleProfitFromCents(profitCentsNums);
    if (!result.success) {
      throw new BadRequestException(profitFailureMessage(result));
    }
  }
}
