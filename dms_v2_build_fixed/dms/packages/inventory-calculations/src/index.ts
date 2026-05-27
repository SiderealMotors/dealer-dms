/**
 * @dms/inventory-calculations — single source of truth for inventory tax, totals, profit, and lot days.
 * Monetary **calculations** use integer cents (`bigint`); wire/API values use fixed 2-decimal **strings**.
 */

export * from './tax-constants';
export type { MoneyCents } from './money';
export {
  addDecimalStrings,
  centsToDecimalString,
  centsToDollars,
  compareDecimalMoneyStrings,
  decimalLikeToCents,
  decimalLikeToCentsOrNull,
  decimalLikeToMoneyNumber,
  decimalLikeToMoneyNumberOrNull,
  dollarsToCents,
  finiteMoneyNumberToCents,
  parseFixed2DecimalMoneyString,
  parseMoneyInputStringToCents,
  percentOfCents,
  sumDecimalStrings,
} from './money';
export {
  computeInventoryTaxOnDecimalString,
  inventoryHstCentsOnPreTaxBase,
  inventoryHstDecimalStringOnPreTaxCents,
  inventoryHstDollarsOnPreTaxDollars,
  purchaseTaxAndTotalFromPreTaxCents,
} from './inventory-tax';
export * from './lot-days';
export * from './types';
export {
  computeVehicleProfit,
  computeVehicleProfitFromCents,
  type VehicleProfitCentsInput,
  type VehicleProfitNumericInput,
  type ComputeVehicleProfitResult,
} from './vehicle-profit';
export {
  computeVehicleInventorySnapshot,
  computeVehicleFinancials,
  computeInventoryTaxOnDollars,
} from './vehicle-snapshot';
