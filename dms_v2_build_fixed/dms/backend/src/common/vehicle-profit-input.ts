import type { Vehicle } from '@prisma/client';
import {
  decimalLikeToCents,
  decimalLikeToCentsOrNull,
  type VehicleProfitCentsInput,
} from '../lib/inventory-calculations';

/** Monetary columns used by profit, revenue, and acquisition-cost helpers (full `Vehicle` rows satisfy this). */
export type VehicleMoneyFields = Pick<
  Vehicle,
  | 'purchasePrice'
  | 'safetyCost'
  | 'gas'
  | 'warrantyCost'
  | 'floorplanInterestCost'
  | 'referralAmount'
  | 'sellingPrice'
  | 'safetyCharge'
  | 'warrantyCharge'
  | 'omvicFee'
>;

/**
 * Maps a Prisma `Vehicle` row to {@link computeVehicleProfitFromCents} inputs (integer cents, `bigint`).
 */
export function vehicleToProfitCentsInput(v: VehicleMoneyFields): VehicleProfitCentsInput {
  return {
    purchasePriceCents: decimalLikeToCents(v.purchasePrice),
    safetyCostCents: decimalLikeToCents(v.safetyCost),
    gasCents: decimalLikeToCents(v.gas),
    warrantyCostCents: decimalLikeToCents(v.warrantyCost),
    floorplanInterestCents: decimalLikeToCents(v.floorplanInterestCost),
    referralCents: decimalLikeToCents(v.referralAmount),
    sellingPriceCents: decimalLikeToCentsOrNull(v.sellingPrice),
    safetyChargeCents: decimalLikeToCentsOrNull(v.safetyCharge),
    warrantyChargeCents: decimalLikeToCentsOrNull(v.warrantyCharge),
    omvicFeeCents: decimalLikeToCentsOrNull(v.omvicFee),
  };
}
