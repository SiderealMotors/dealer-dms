import { Decimal } from '@prisma/client/runtime/library';
import type { Deal, Vehicle } from '@prisma/client';

export type FieldChange = { from: unknown; to: unknown };

/** Scalar fields we record for inventory audit (exclude relation payloads). */
export const VEHICLE_AUDIT_FIELDS = [
  'datePurchased',
  'vin',
  'year',
  'make',
  'model',
  'trim',
  'colour',
  'odometer',
  'status',
  'purchasePrice',
  'safetyEstimate',
  'safetyCost',
  'floorplanInterestCost',
  'gas',
  'warrantyCost',
  'dateSold',
  'sellingPrice',
  'safetyCharge',
  'warrantyCharge',
  'omvicFee',
  'buyerName',
  'referralAmount',
  'paymentMethod',
  'depositAmount',
  'salesPersonId',
  'salesPersonName',
  'glRevenueJournalId',
  'glCogsJournalId',
] as const satisfies readonly (keyof Vehicle)[];

export const DEAL_AUDIT_FIELDS = [
  'customerId',
  'vehicleId',
  'title',
  'value',
  'stage',
  'closedAt',
  'notes',
] as const satisfies readonly (keyof Deal)[];

export function serializeAuditScalar(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Decimal.isDecimal(value)) {
    return value.toString();
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

function auditValuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function diffVehicleAudit(
  before: Vehicle,
  after: Vehicle,
): Record<string, FieldChange> {
  const out: Record<string, FieldChange> = {};
  for (const key of VEHICLE_AUDIT_FIELDS) {
    const from = serializeAuditScalar(before[key]);
    const to = serializeAuditScalar(after[key]);
    if (!auditValuesEqual(from, to)) {
      out[key] = { from, to };
    }
  }
  return out;
}

export function diffDealAudit(before: Deal, after: Deal): Record<string, FieldChange> {
  const out: Record<string, FieldChange> = {};
  for (const key of DEAL_AUDIT_FIELDS) {
    const from = serializeAuditScalar(before[key]);
    const to = serializeAuditScalar(after[key]);
    if (!auditValuesEqual(from, to)) {
      out[key] = { from, to };
    }
  }
  return out;
}

export function buildDealCreateAudit(row: Deal): Record<string, FieldChange> {
  const out: Record<string, FieldChange> = {
    _event: { from: null, to: 'created' },
  };
  for (const key of DEAL_AUDIT_FIELDS) {
    const to = serializeAuditScalar(row[key]);
    out[key] = { from: null, to };
  }
  return out;
}
