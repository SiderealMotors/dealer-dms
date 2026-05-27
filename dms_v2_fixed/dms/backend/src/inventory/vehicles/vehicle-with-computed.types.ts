/** Serialized vehicle + inventory snapshot (tax, profit, lot days) from centralized calculators. */
export interface VehicleWithComputed extends Record<string, unknown> {
  id: string;
  datePurchased: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  colour: string;
  odometer: number;
  /** Fixed 2-decimal string (no binary float). */
  purchasePrice: string;
  taxCost: string;
  totalPurchasePrice: string;
  safetyEstimate: string | null;
  safetyCost: string;
  safetyTax: string;
  floorplanInterestCost: string;
  gas: string;
  gasTax: string;
  warrantyCost: string;
  warrantyTax: string;
  dateSold: string | null;
  sellingPrice: string | null;
  safetyCharge: string | null;
  warrantyCharge: string | null;
  omvicFee: string | null;
  sellTax: string | null;
  buyerName: string | null;
  referralAmount: string;
  paymentMethod: string | null;
  depositAmount: string | null;
  salesPersonId: string | null;
  salesPersonName: string | null;
  salesPerson?: { id: string; fullName: string; email: string } | null;
  lotDays: number;
  lotDaysColor: 'green' | 'yellow' | 'red';
  profit: string | null;
  /** Derived: `sold` when dateSold is set; otherwise stored listing status. */
  status: 'available' | 'pending' | 'sold';
  createdAt: string;
  updatedAt: string;
}
