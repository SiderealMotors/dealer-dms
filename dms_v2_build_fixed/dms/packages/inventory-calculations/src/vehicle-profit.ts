import { centsToDecimalString, finiteMoneyNumberToCents } from './money';
import { inventoryHstCentsOnPreTaxBase, purchaseTaxAndTotalFromPreTaxCents } from './inventory-tax';
import type { MoneyCents } from './money';

export interface VehicleProfitCentsInput {
  purchasePriceCents: MoneyCents;
  safetyCostCents: MoneyCents;
  gasCents: MoneyCents;
  warrantyCostCents: MoneyCents;
  floorplanInterestCents: MoneyCents;
  referralCents: MoneyCents;
  sellingPriceCents: MoneyCents | null | undefined;
  safetyChargeCents: MoneyCents | null | undefined;
  warrantyChargeCents: MoneyCents | null | undefined;
  omvicFeeCents: MoneyCents | null | undefined;
}

/** @deprecated Use {@link VehicleProfitCentsInput} (all amounts in integer cents). */
export type VehicleProfitNumericInput = {
  purchasePrice: number;
  safetyCost: number;
  gas: number;
  warrantyCost: number;
  floorplanInterestCost: number;
  referralAmount: number;
  sellingPrice: number | null | undefined;
  safetyCharge: number | null | undefined;
  warrantyCharge: number | null | undefined;
  omvicFee: number | null | undefined;
};

export type ComputeVehicleProfitResult =
  | { success: true; profitCents: MoneyCents; profit: string }
  | {
      success: false;
      code: 'MISSING_SALE_LINE' | 'NON_FINITE_INPUT' | 'NEGATIVE_AMOUNT';
      field?: string;
    };

function validateNonNegativeCents(
  label: string,
  value: MoneyCents,
  allowNegative: boolean,
): ComputeVehicleProfitResult | null {
  if (!allowNegative && value < 0n) {
    return { success: false, code: 'NEGATIVE_AMOUNT', field: label };
  }
  return null;
}

function checkAcquisitionCents(
  label: string,
  value: MoneyCents,
  allowNegative: boolean,
): ComputeVehicleProfitResult | null {
  const err = validateNonNegativeCents(label, value, allowNegative);
  if (err) {
    return err;
  }
  return null;
}

function checkSaleLineCents(
  label: string,
  value: MoneyCents | null | undefined,
  allowNegative: boolean,
): ComputeVehicleProfitResult | null {
  if (value === null || value === undefined) {
    return { success: false, code: 'MISSING_SALE_LINE', field: label };
  }
  return validateNonNegativeCents(label, value, allowNegative);
}

/**
 * Pre-tax vehicle profit (sell HST is pass-through and excluded).
 * All amounts are **integer cents** (`bigint`).
 */
export function computeVehicleProfitFromCents(
  input: VehicleProfitCentsInput,
  options?: { allowNegativeAmounts?: boolean },
): ComputeVehicleProfitResult {
  const allowNegative = options?.allowNegativeAmounts === true;

  const acqChecks: Array<[string, MoneyCents]> = [
    ['purchasePrice', input.purchasePriceCents],
    ['safetyCost', input.safetyCostCents],
    ['gas', input.gasCents],
    ['warrantyCost', input.warrantyCostCents],
    ['floorplanInterestCost', input.floorplanInterestCents],
    ['referralAmount', input.referralCents],
  ];
  for (const [label, v] of acqChecks) {
    const err = checkAcquisitionCents(label, v, allowNegative);
    if (err) {
      return err;
    }
  }

  const saleChecks: Array<[string, MoneyCents | null | undefined]> = [
    ['sellingPrice', input.sellingPriceCents],
    ['safetyCharge', input.safetyChargeCents],
    ['warrantyCharge', input.warrantyChargeCents],
    ['omvicFee', input.omvicFeeCents],
  ];
  for (const [label, v] of saleChecks) {
    const err = checkSaleLineCents(label, v, allowNegative);
    if (err) {
      return err;
    }
  }

  const { totalPurchaseCents } = purchaseTaxAndTotalFromPreTaxCents(input.purchasePriceCents);

  const safetyTaxCents = inventoryHstCentsOnPreTaxBase(input.safetyCostCents);
  const gasTaxCents = inventoryHstCentsOnPreTaxBase(input.gasCents);
  const warrantyTaxCents = inventoryHstCentsOnPreTaxBase(input.warrantyCostCents);

  const spC = input.sellingPriceCents!;
  const scC = input.safetyChargeCents!;
  const wcC = input.warrantyChargeCents!;
  const omC = input.omvicFeeCents!;

  const revenueCents = spC + scC + wcC + omC;
  const costCents =
    totalPurchaseCents +
    input.safetyCostCents +
    safetyTaxCents +
    input.floorplanInterestCents +
    input.gasCents +
    gasTaxCents +
    input.warrantyCostCents +
    warrantyTaxCents +
    input.referralCents;

  const profitCents = revenueCents - costCents;
  return {
    success: true,
    profitCents,
    profit: centsToDecimalString(profitCents),
  };
}

function asCentsOrNonFinite(label: string, v: number): MoneyCents | ComputeVehicleProfitResult {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    return { success: false, code: 'NON_FINITE_INPUT', field: label };
  }
  try {
    return finiteMoneyNumberToCents(v);
  } catch {
    return { success: false, code: 'NON_FINITE_INPUT', field: label };
  }
}

/**
 * Legacy entry: validated JSON numbers (≤2 dp) → cents pipeline.
 * @deprecated Prefer {@link computeVehicleProfitFromCents} after converting inputs with {@link finiteMoneyNumberToCents}.
 */
export function computeVehicleProfit(
  input: VehicleProfitNumericInput,
  options?: { allowNegativeAmounts?: boolean },
): ComputeVehicleProfitResult {
  const pp = asCentsOrNonFinite('purchasePrice', input.purchasePrice);
  if (typeof pp !== 'bigint') {
    return pp;
  }
  const sc = asCentsOrNonFinite('safetyCost', input.safetyCost);
  if (typeof sc !== 'bigint') {
    return sc;
  }
  const g = asCentsOrNonFinite('gas', input.gas);
  if (typeof g !== 'bigint') {
    return g;
  }
  const wc = asCentsOrNonFinite('warrantyCost', input.warrantyCost);
  if (typeof wc !== 'bigint') {
    return wc;
  }
  const fp = asCentsOrNonFinite('floorplanInterestCost', input.floorplanInterestCost);
  if (typeof fp !== 'bigint') {
    return fp;
  }
  const ref = asCentsOrNonFinite('referralAmount', input.referralAmount);
  if (typeof ref !== 'bigint') {
    return ref;
  }

  let spC: MoneyCents | ComputeVehicleProfitResult | null = null;
  let saC: MoneyCents | ComputeVehicleProfitResult | null = null;
  let waC: MoneyCents | ComputeVehicleProfitResult | null = null;
  let omC: MoneyCents | ComputeVehicleProfitResult | null = null;

  if (input.sellingPrice != null) {
    spC = asCentsOrNonFinite('sellingPrice', input.sellingPrice);
    if (typeof spC !== 'bigint') {
      return spC;
    }
  }
  if (input.safetyCharge != null) {
    saC = asCentsOrNonFinite('safetyCharge', input.safetyCharge);
    if (typeof saC !== 'bigint') {
      return saC;
    }
  }
  if (input.warrantyCharge != null) {
    waC = asCentsOrNonFinite('warrantyCharge', input.warrantyCharge);
    if (typeof waC !== 'bigint') {
      return waC;
    }
  }
  if (input.omvicFee != null) {
    omC = asCentsOrNonFinite('omvicFee', input.omvicFee);
    if (typeof omC !== 'bigint') {
      return omC;
    }
  }

  return computeVehicleProfitFromCents(
    {
      purchasePriceCents: pp as MoneyCents,
      safetyCostCents: sc as MoneyCents,
      gasCents: g as MoneyCents,
      warrantyCostCents: wc as MoneyCents,
      floorplanInterestCents: fp as MoneyCents,
      referralCents: ref as MoneyCents,
      sellingPriceCents: spC as MoneyCents | null,
      safetyChargeCents: saC as MoneyCents | null,
      warrantyChargeCents: waC as MoneyCents | null,
      omvicFeeCents: omC as MoneyCents | null,
    },
    options,
  );
}
