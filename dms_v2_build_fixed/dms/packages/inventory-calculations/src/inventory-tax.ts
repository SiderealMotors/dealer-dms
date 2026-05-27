/**
 * Central tax engine: every inventory HST line flows through here (always {@link INVENTORY_HST_PERCENT_POINTS}%).
 */
import { INVENTORY_HST_PERCENT_POINTS } from './tax-constants';
import {
  centsToDecimalString,
  finiteMoneyNumberToCents,
  parseFixed2DecimalMoneyString,
  percentOfCents,
  type MoneyCents,
} from './money';

export { INVENTORY_HST_PERCENT_POINTS as INVENTORY_TAX_RATE_PERCENT } from './tax-constants';

/** 13% on a pre-tax amount expressed in cents; result is tax cents (half-up). */
export function inventoryHstCentsOnPreTaxBase(preTaxBaseCents: MoneyCents): MoneyCents {
  return percentOfCents(preTaxBaseCents, INVENTORY_HST_PERCENT_POINTS);
}

/** Purchase tax + total landed cost (pre-tax purchase + its HST). */
export function purchaseTaxAndTotalFromPreTaxCents(preTaxPurchaseCents: MoneyCents): {
  purchaseTaxCents: MoneyCents;
  totalPurchaseCents: MoneyCents;
} {
  const purchaseTaxCents = inventoryHstCentsOnPreTaxBase(preTaxPurchaseCents);
  return {
    purchaseTaxCents,
    totalPurchaseCents: preTaxPurchaseCents + purchaseTaxCents,
  };
}

/** HST as decimal string on pre-tax cents (2 dp). */
export function inventoryHstDecimalStringOnPreTaxCents(preTaxBaseCents: MoneyCents): string {
  return centsToDecimalString(inventoryHstCentsOnPreTaxBase(preTaxBaseCents));
}

/**
 * Convenience: HST dollars on pre-tax dollars (2 dp), for legacy UI one-offs.
 * Uses string round-trip — `preTaxDollars` should come from validated 2dp input.
 */
export function inventoryHstDollarsOnPreTaxDollars(preTaxDollars: number): string {
  const base = finiteMoneyNumberToCents(preTaxDollars);
  return centsToDecimalString(inventoryHstCentsOnPreTaxBase(base));
}

/** Parse a 2dp decimal string to cents then apply HST; returns tax as decimal string. */
export function computeInventoryTaxOnDecimalString(preTaxDecimal: string): string {
  return inventoryHstDecimalStringOnPreTaxCents(parseFixed2DecimalMoneyString(preTaxDecimal));
}
