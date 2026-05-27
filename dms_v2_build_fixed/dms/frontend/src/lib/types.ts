export interface Salesperson {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

/** API money fields: fixed 2-decimal strings (e.g. `"1234.56"`). */
export interface VehicleRow {
  id: string;
  datePurchased: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  colour: string;
  odometer: number;
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
  /** `sold` when date sold is set; otherwise available vs pending listing state. */
  status: 'available' | 'pending' | 'sold';
  lotDays: number;
  lotDaysColor: 'green' | 'yellow' | 'red';
  profit: string | null;
  createdAt: string;
  updatedAt: string;
}
