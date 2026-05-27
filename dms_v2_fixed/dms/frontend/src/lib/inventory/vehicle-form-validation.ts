/**
 * Client-side validation aligned with `backend/src/inventory/validation/vehicle-business-rules.ts`.
 * All taxes in the app use 13% (HST-style); invalid data must not be submitted.
 */

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;
const MAX_MONEY = 99_999_999.99;

export type VehicleFormFields = Record<string, string>;

export type VehicleFormValidationResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string>; summary: string };

function parseRequiredInt(raw: string, label: string): { ok: true; value: number } | { ok: false; msg: string } {
  const t = raw.trim();
  if (t === '') {
    return { ok: false, msg: `${label} is required.` };
  }
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n)) {
    return { ok: false, msg: `${label} must be a whole number.` };
  }
  return { ok: true, value: n };
}

function parseRequiredMoney(raw: string, label: string): { ok: true; value: number } | { ok: false; msg: string } {
  const t = raw.trim();
  if (t === '') {
    return { ok: false, msg: `${label} is required.` };
  }
  const n = Number(t);
  if (!Number.isFinite(n)) {
    return { ok: false, msg: `${label} must be a finite number.` };
  }
  if (n < 0) {
    return { ok: false, msg: `${label} cannot be negative.` };
  }
  if (n > MAX_MONEY) {
    return { ok: false, msg: `${label} is too large.` };
  }
  const rounded = Math.round(n * 100) / 100;
  if (Math.abs(n - rounded) > 1e-9) {
    return { ok: false, msg: `${label} must have at most 2 decimal places.` };
  }
  return { ok: true, value: n };
}

function parseOptionalMoney(raw: string, label: string): { ok: true; value: number | undefined } | { ok: false; msg: string } {
  const t = raw.trim();
  if (t === '') {
    return { ok: true, value: undefined };
  }
  return parseRequiredMoney(t, label);
}

function isValidYmd(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * Validates the inventory form before POST/PATCH. Returns field keys for inline hints.
 */
export function validateVehicleForm(f: VehicleFormFields): VehicleFormValidationResult {
  const errors: Record<string, string> = {};

  const set = (key: string, msg: string) => {
    if (!errors[key]) {
      errors[key] = msg;
    }
  };

  if (!f.datePurchased?.trim()) {
    set('datePurchased', 'Date purchased is required.');
  } else if (!isValidYmd(f.datePurchased)) {
    set('datePurchased', 'Use a valid calendar date (YYYY-MM-DD).');
  }

  if (!f.vin?.trim()) {
    set('vin', 'VIN is required.');
  } else if (!VIN_REGEX.test(f.vin.trim())) {
    set('vin', 'VIN must be 17 characters (letters A–Z and digits; no I, O, or Q).');
  }

  const year = parseRequiredInt(f.year, 'Year');
  if (!year.ok) set('year', year.msg);
  else if (year.value < 1980 || year.value > new Date().getFullYear() + 1) {
    set('year', 'Year is out of allowed range.');
  }

  if (!f.make?.trim()) set('make', 'Make is required.');
  if (!f.model?.trim()) set('model', 'Model is required.');
  if (!f.trim?.trim()) set('trim', 'Trim is required.');
  if (!f.colour?.trim()) set('colour', 'Colour is required.');

  const odo = parseRequiredInt(f.odometer, 'Odometer');
  if (!odo.ok) set('odometer', odo.msg);
  else if (odo.value < 0) set('odometer', 'Odometer cannot be negative.');

  const purchase = parseRequiredMoney(f.purchasePrice, 'Purchase price');
  if (!purchase.ok) set('purchasePrice', purchase.msg);

  const safetyEst = parseOptionalMoney(f.safetyEstimate, 'Safety estimate');
  if (!safetyEst.ok) set('safetyEstimate', safetyEst.msg);

  const safetyCost = parseRequiredMoney(f.safetyCost || '0', 'Safety cost');
  if (!safetyCost.ok) set('safetyCost', safetyCost.msg);

  const floor = parseRequiredMoney(f.floorplanInterestCost || '0', 'Floorplan interest');
  if (!floor.ok) set('floorplanInterestCost', floor.msg);

  const gas = parseRequiredMoney(f.gas || '0', 'Gas');
  if (!gas.ok) set('gas', gas.msg);

  const warrantyCost = parseRequiredMoney(f.warrantyCost || '0', 'Warranty cost');
  if (!warrantyCost.ok) set('warrantyCost', warrantyCost.msg);

  const referral = parseRequiredMoney(f.referralAmount || '0', 'Referral amount');
  if (!referral.ok) set('referralAmount', referral.msg);

  const deposit = parseOptionalMoney(f.depositAmount, 'Deposit');
  if (!deposit.ok) set('depositAmount', deposit.msg);

  if (f.dateSold?.trim()) {
    if (!isValidYmd(f.dateSold)) {
      set('dateSold', 'Use a valid calendar date (YYYY-MM-DD).');
    } else if (f.datePurchased?.trim() && isValidYmd(f.datePurchased) && f.dateSold < f.datePurchased) {
      set('dateSold', 'Date sold cannot be before date purchased.');
    }

    const sp = parseRequiredMoney(f.sellingPrice, 'Selling price');
    if (!sp.ok) set('sellingPrice', sp.msg);

    const sc = parseRequiredMoney(f.safetyCharge, 'Safety charge');
    if (!sc.ok) set('safetyCharge', sc.msg);

    const wc = parseRequiredMoney(f.warrantyCharge, 'Warranty charge');
    if (!wc.ok) set('warrantyCharge', wc.msg);

    const om = parseRequiredMoney(f.omvicFee, 'OMVIC fee');
    if (!om.ok) set('omvicFee', om.msg);
  }

  if (Object.keys(errors).length === 0) {
    return { ok: true };
  }

  const summary = Object.entries(errors)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' ');

  return { ok: false, errors, summary };
}
