/**
 * Money as integer cents (`bigint`). All arithmetic is exact; no IEEE-754 dollar floats in the pipeline.
 * Boundaries: Prisma.Decimal / API strings use fixed 2-decimal strings, never binary floats.
 */

export type MoneyCents = bigint;

/**
 * Parses a fixed 2-decimal string (e.g. from `Prisma.Decimal.toFixed(2)` or validated user input).
 */
export function parseFixed2DecimalMoneyString(s: string): MoneyCents {
  const t = s.trim();
  if (!t || t === 'NaN') {
    throw new Error('Invalid money string');
  }
  const neg = t.startsWith('-');
  const u = neg ? t.slice(1) : t;
  const parts = u.split('.');
  const intPart = parts[0] ?? '0';
  const fracRaw = parts[1] ?? '00';
  if (parts.length > 2) {
    throw new Error('Invalid money string');
  }
  if (!/^\d+$/.test(intPart) || !/^\d+$/.test(fracRaw)) {
    throw new Error('Invalid money string');
  }
  const frac = (fracRaw + '00').slice(0, 2);
  const cents = BigInt(intPart) * 100n + BigInt(frac);
  return neg ? -cents : cents;
}

export function decimalLikeToCents(v: { toFixed: (n: number) => string }): MoneyCents {
  return parseFixed2DecimalMoneyString(v.toFixed(2));
}

export function decimalLikeToCentsOrNull(
  v: { toFixed: (n: number) => string } | null | undefined,
): MoneyCents | null {
  if (v == null) {
    return null;
  }
  return decimalLikeToCents(v);
}

/** Canonical non-negative display / wire format: `[-]dddd.dd` */
export function centsToDecimalString(cents: MoneyCents): string {
  const neg = cents < 0n;
  const x = neg ? -cents : cents;
  const dollars = x / 100n;
  const frac = x % 100n;
  return `${neg ? '-' : ''}${dollars.toString()}.${frac.toString().padStart(2, '0')}`;
}

/**
 * User/form input: trim, strip commas, require at most 2 decimal places.
 * Empty → `0n`.
 */
export function parseMoneyInputStringToCents(raw: string): MoneyCents {
  const s = raw.trim().replace(/,/g, '');
  if (s === '') {
    return 0n;
  }
  if (!/^-?\d+(\.\d{0,2})?$/.test(s)) {
    throw new Error('Invalid money input');
  }
  const [intPart, frac = ''] = s.split('.');
  const normalized = `${intPart}.${(frac + '00').slice(0, 2)}`;
  return parseFixed2DecimalMoneyString(normalized);
}

/**
 * HTTP / JSON number boundary: value was validated to ≤2 dp. Uses `toFixed(2)` on the number
 * (not `* 100`) so the digit string is canonicalized before parsing — still a float *input* edge.
 */
export function finiteMoneyNumberToCents(n: number): MoneyCents {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new Error('amount must be a finite number');
  }
  return parseFixed2DecimalMoneyString(n.toFixed(2));
}

/** Half-away-from-zero percent of cents (e.g. 13 → 13%). */
export function percentOfCents(amount: MoneyCents, percentPoints: number): MoneyCents {
  if (!Number.isFinite(percentPoints)) {
    throw new Error('percentOfCents: non-finite percent');
  }
  const p = BigInt(Math.trunc(percentPoints));
  const num = amount * p;
  if (num >= 0n) {
    return (num + 50n) / 100n;
  }
  return (num - 50n) / 100n;
}

export function addDecimalStrings(a: string, b: string): string {
  return centsToDecimalString(
    parseFixed2DecimalMoneyString(a) + parseFixed2DecimalMoneyString(b),
  );
}

export function sumDecimalStrings(values: string[]): string {
  let t = 0n;
  for (const v of values) {
    t += parseFixed2DecimalMoneyString(v);
  }
  return centsToDecimalString(t);
}

export function compareDecimalMoneyStrings(a: string, b: string): number {
  const da = parseFixed2DecimalMoneyString(a);
  const db = parseFixed2DecimalMoneyString(b);
  if (da < db) {
    return -1;
  }
  if (da > db) {
    return 1;
  }
  return 0;
}

/** @deprecated Use {@link finiteMoneyNumberToCents} + {@link centsToDecimalString} for boundaries only. */
export function dollarsToCents(d: number): number {
  return Number(finiteMoneyNumberToCents(d));
}

/** @deprecated Use {@link centsToDecimalString} and parse on the client; do not use for calculations. */
export function centsToDollars(cents: number): number {
  if (!Number.isFinite(cents)) {
    throw new Error('cents must be finite');
  }
  return Number(centsToDecimalString(BigInt(Math.trunc(cents))));
}

/** @deprecated Use {@link decimalLikeToCents} + {@link centsToDecimalString}. */
export function decimalLikeToMoneyNumber(v: { toFixed: (n: number) => string }): number {
  return Number(centsToDecimalString(decimalLikeToCents(v)));
}

/** @deprecated Use {@link decimalLikeToCentsOrNull} + {@link centsToDecimalString}. */
export function decimalLikeToMoneyNumberOrNull(
  v: { toFixed: (n: number) => string } | null | undefined,
): number | null {
  const c = decimalLikeToCentsOrNull(v);
  return c == null ? null : Number(centsToDecimalString(c));
}
