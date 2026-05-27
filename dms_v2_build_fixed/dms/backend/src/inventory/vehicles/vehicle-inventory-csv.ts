import { Parser } from '@json2csv/plainjs';
import type { VehicleWithComputed } from './vehicle-with-computed.types';

/** Column order and human-readable headers for inventory CSV (values come from {@link VehicleWithComputed} via centralized `serialize`). */
const INVENTORY_CSV_FIELDS: { label: string; key: keyof VehicleWithComputed | 'salesPersonEmail' }[] = [
  { label: 'Vehicle ID', key: 'id' },
  { label: 'VIN', key: 'vin' },
  { label: 'Year', key: 'year' },
  { label: 'Make', key: 'make' },
  { label: 'Model', key: 'model' },
  { label: 'Trim', key: 'trim' },
  { label: 'Colour', key: 'colour' },
  { label: 'Odometer (km)', key: 'odometer' },
  { label: 'Status', key: 'status' },
  { label: 'Date Purchased', key: 'datePurchased' },
  { label: 'Date Sold', key: 'dateSold' },
  { label: 'Purchase Price', key: 'purchasePrice' },
  { label: 'Tax Cost', key: 'taxCost' },
  { label: 'Total Purchase Price', key: 'totalPurchasePrice' },
  { label: 'Safety Estimate', key: 'safetyEstimate' },
  { label: 'Safety Cost', key: 'safetyCost' },
  { label: 'Safety Tax', key: 'safetyTax' },
  { label: 'Floorplan Interest Cost', key: 'floorplanInterestCost' },
  { label: 'Gas', key: 'gas' },
  { label: 'Gas Tax', key: 'gasTax' },
  { label: 'Warranty Cost', key: 'warrantyCost' },
  { label: 'Warranty Tax', key: 'warrantyTax' },
  { label: 'Selling Price', key: 'sellingPrice' },
  { label: 'Safety Charge', key: 'safetyCharge' },
  { label: 'Warranty Charge', key: 'warrantyCharge' },
  { label: 'OMVIC Fee', key: 'omvicFee' },
  { label: 'Sell Tax', key: 'sellTax' },
  { label: 'Buyer Name', key: 'buyerName' },
  { label: 'Referral Amount', key: 'referralAmount' },
  { label: 'Payment Method', key: 'paymentMethod' },
  { label: 'Deposit Amount', key: 'depositAmount' },
  { label: 'Salesperson ID', key: 'salesPersonId' },
  { label: 'Salesperson Name', key: 'salesPersonName' },
  { label: 'Salesperson Email', key: 'salesPersonEmail' },
  { label: 'Lot Days', key: 'lotDays' },
  { label: 'Lot Days Color', key: 'lotDaysColor' },
  { label: 'Profit', key: 'profit' },
  { label: 'Created At', key: 'createdAt' },
  { label: 'Updated At', key: 'updatedAt' },
];

function ymdFromApiDate(isoOrYmd: string): string {
  if (!isoOrYmd) return '';
  return isoOrYmd.length >= 10 ? isoOrYmd.slice(0, 10) : isoOrYmd;
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) {
    return '';
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return String(v);
  }
  return String(v);
}

/**
 * Flattens serialized rows for CSV (no tax/profit math — uses API snapshot fields only).
 */
export function vehicleComputedRowsToCsvRecords(v: VehicleWithComputed): Record<string, string> {
  const rec: Record<string, string> = {};
  for (const { label, key } of INVENTORY_CSV_FIELDS) {
    if (key === 'salesPersonEmail') {
      rec[label] = v.salesPerson?.email ?? '';
      continue;
    }
    const val = v[key];
    if (key === 'createdAt' || key === 'updatedAt') {
      rec[label] = typeof val === 'string' ? ymdFromApiDate(val) : '';
      continue;
    }
    if (key === 'dateSold' || key === 'datePurchased') {
      rec[label] = val == null ? '' : typeof val === 'string' ? ymdFromApiDate(val) : cellToString(val);
      continue;
    }
    rec[label] = cellToString(val);
  }
  return rec;
}

export function buildInventoryCsv(vehicles: VehicleWithComputed[]): string {
  const rows = vehicles.map(vehicleComputedRowsToCsvRecords);
  const fields = INVENTORY_CSV_FIELDS.map((f) => f.label);
  if (rows.length === 0) {
    return '\ufeff' + fields.join(',') + '\n';
  }
  const parser = new Parser({ fields, withBOM: true });
  return parser.parse(rows);
}
