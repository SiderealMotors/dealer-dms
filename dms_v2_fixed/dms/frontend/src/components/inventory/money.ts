import {
  compareDecimalMoneyStrings,
  parseMoneyInputStringToCents,
  type MoneyCents,
} from '@dms/inventory-calculations';

/** Format a fixed 2-decimal money string as CAD (no float math). */
export function formatCad(amount: string): string {
  const neg = amount.startsWith('-');
  const u = neg ? amount.slice(1) : amount;
  const [intPart, frac = '00'] = u.split('.');
  const frac2 = (frac + '00').slice(0, 2);
  const dollars = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}$${dollars}.${frac2}`;
}

/** Legacy: parse user input; prefer {@link parseMoneyStringToCents} for calculations. */
export function parseNum(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function parseMoneyStringToCents(raw: string): MoneyCents {
  try {
    return parseMoneyInputStringToCents(raw);
  } catch {
    return 0n;
  }
}

export function isMoneyStringPositive(s: string): boolean {
  return compareDecimalMoneyStrings(s, '0.00') > 0;
}

export function isMoneyStringNegative(s: string): boolean {
  return compareDecimalMoneyStrings(s, '0.00') < 0;
}
