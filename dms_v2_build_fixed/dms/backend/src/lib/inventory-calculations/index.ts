/**
 * Inlined inventory-calculations — replaces @dms/inventory-calculations workspace package.
 * All imports inside the backend should point here instead of the old package name.
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
