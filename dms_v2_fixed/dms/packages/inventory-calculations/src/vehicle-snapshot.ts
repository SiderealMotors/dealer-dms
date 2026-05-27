/**
 * Orchestrates taxes, total purchase, lot metrics, sell tax, and profit in one call.
 * All HST lines use {@link inventoryHstCentsOnPreTaxBase} / {@link purchaseTaxAndTotalFromPreTaxCents}.
 */
import { centsToDecimalString, finiteMoneyNumberToCents } from './money';
import {
  inventoryHstCentsOnPreTaxBase,
  inventoryHstDollarsOnPreTaxDollars,
  purchaseTaxAndTotalFromPreTaxCents,
} from './inventory-tax';
import { computeLotDays, lotDaysColor } from './lot-days';
import { computeVehicleProfitFromCents } from './vehicle-profit';
import type { ComputedVehicleFinancials, VehicleDateInput, VehicleMoneyCentsInput, VehicleNumericInput } from './types';

function isNonEmptyYmd(s: string | null | undefined): boolean {
  return s != null && String(s).trim().length > 0;
}

function numsFromLegacyDollars(nums: VehicleNumericInput): VehicleMoneyCentsInput {
  const n = finiteMoneyNumberToCents;
  return {
    purchasePriceCents: n(nums.purchasePrice),
    safetyCostCents: n(nums.safetyCost),
    gasCents: n(nums.gas),
    warrantyCostCents: n(nums.warrantyCost),
    floorplanInterestCents: n(nums.floorplanInterestCost),
    referralCents: n(nums.referralAmount),
    sellingPriceCents: nums.sellingPrice == null ? null : n(nums.sellingPrice),
    safetyChargeCents: nums.safetyCharge == null ? null : n(nums.safetyCharge),
    warrantyChargeCents: nums.warrantyCharge == null ? null : n(nums.warrantyCharge),
    omvicFeeCents: nums.omvicFee == null ? null : n(nums.omvicFee),
  };
}

/**
 * Full inventory financial snapshot. Inputs are **integer cents** (`bigint`).
 */
export function computeVehicleInventorySnapshot(
  dates: VehicleDateInput,
  nums: VehicleMoneyCentsInput,
  referenceDate: Date = new Date(),
): ComputedVehicleFinancials {
  const { purchaseTaxCents, totalPurchaseCents } = purchaseTaxAndTotalFromPreTaxCents(nums.purchasePriceCents);

  const safetyTaxCents = inventoryHstCentsOnPreTaxBase(nums.safetyCostCents);
  const gasTaxCents = inventoryHstCentsOnPreTaxBase(nums.gasCents);
  const warrantyTaxCents = inventoryHstCentsOnPreTaxBase(nums.warrantyCostCents);

  const lotDays = computeLotDays(dates.datePurchased, dates.dateSold, referenceDate);

  let sellTax: string | null = null;
  let profit: string | null = null;

  if (isNonEmptyYmd(dates.dateSold)) {
    const profitInput = {
      purchasePriceCents: nums.purchasePriceCents,
      safetyCostCents: nums.safetyCostCents,
      gasCents: nums.gasCents,
      warrantyCostCents: nums.warrantyCostCents,
      floorplanInterestCents: nums.floorplanInterestCents,
      referralCents: nums.referralCents,
      sellingPriceCents: nums.sellingPriceCents,
      safetyChargeCents: nums.safetyChargeCents,
      warrantyChargeCents: nums.warrantyChargeCents,
      omvicFeeCents: nums.omvicFeeCents,
    };
    const profitResult = computeVehicleProfitFromCents(profitInput);
    if (profitResult.success) {
      profit = profitResult.profit;
      const sellBaseCents =
        nums.sellingPriceCents! +
        nums.safetyChargeCents! +
        nums.warrantyChargeCents! +
        nums.omvicFeeCents!;
      sellTax = centsToDecimalString(inventoryHstCentsOnPreTaxBase(sellBaseCents));
    }
  }

  return {
    taxCost: centsToDecimalString(purchaseTaxCents),
    totalPurchasePrice: centsToDecimalString(totalPurchaseCents),
    safetyTax: centsToDecimalString(safetyTaxCents),
    gasTax: centsToDecimalString(gasTaxCents),
    warrantyTax: centsToDecimalString(warrantyTaxCents),
    sellTax,
    lotDays,
    lotDaysColor: lotDaysColor(lotDays),
    profit,
  };
}

/**
 * @deprecated Use {@link computeVehicleInventorySnapshot} with {@link VehicleMoneyCentsInput}.
 * Converts legacy dollar numbers at the boundary via {@link finiteMoneyNumberToCents}.
 */
export function computeVehicleFinancials(
  dates: VehicleDateInput,
  nums: VehicleNumericInput,
  referenceDate: Date = new Date(),
): ComputedVehicleFinancials {
  return computeVehicleInventorySnapshot(dates, numsFromLegacyDollars(nums), referenceDate);
}

/** @deprecated Use {@link computeInventoryTaxOnDecimalString} from `./inventory-tax`. */
export function computeInventoryTaxOnDollars(preTaxDollars: number): string {
  return inventoryHstDollarsOnPreTaxDollars(preTaxDollars);
}
