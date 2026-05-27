import type { MoneyCents } from './money';

export type LotDaysColor = 'green' | 'yellow' | 'red';

/** All monetary fields are integer cents (`bigint`). */
export interface VehicleMoneyCentsInput {
  purchasePriceCents: MoneyCents;
  safetyCostCents: MoneyCents;
  gasCents: MoneyCents;
  warrantyCostCents: MoneyCents;
  floorplanInterestCents: MoneyCents;
  referralCents: MoneyCents;
  sellingPriceCents: MoneyCents | null;
  safetyChargeCents: MoneyCents | null;
  warrantyChargeCents: MoneyCents | null;
  omvicFeeCents: MoneyCents | null;
}

/**
 * @deprecated Use {@link VehicleMoneyCentsInput}. Dollar floats are not used in the calculation pipeline.
 */
export interface VehicleNumericInput {
  purchasePrice: number;
  safetyCost: number;
  gas: number;
  warrantyCost: number;
  floorplanInterestCost: number;
  referralAmount: number;
  sellingPrice: number | null;
  safetyCharge: number | null;
  warrantyCharge: number | null;
  omvicFee: number | null;
}

export interface VehicleDateInput {
  datePurchased: string;
  dateSold: string | null;
}

/** Monetary outputs as fixed 2-decimal strings (no binary floats). */
export interface ComputedVehicleFinancials {
  taxCost: string;
  totalPurchasePrice: string;
  safetyTax: string;
  gasTax: string;
  warrantyTax: string;
  sellTax: string | null;
  lotDays: number;
  lotDaysColor: LotDaysColor;
  profit: string | null;
}
