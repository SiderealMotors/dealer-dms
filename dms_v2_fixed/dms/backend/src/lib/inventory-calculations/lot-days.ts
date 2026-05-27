import type { LotDaysColor } from './types';

export type { LotDaysColor } from './types';

function isNonEmptyYmd(s: string | null | undefined): boolean {
  return s != null && String(s).trim().length > 0;
}

/**
 * Calendar-day difference between two ISO dates (YYYY-MM-DD).
 * Same calendar day → 0; interpreted as UTC calendar to match API `toISOString().slice(0, 10)`.
 */
export function calendarDaysBetweenUtcYmd(startYmd: string, endYmd: string): number {
  const t0 = utcMsFromYmd(startYmd);
  const t1 = utcMsFromYmd(endYmd);
  const raw = Math.round((t1 - t0) / 86_400_000);
  return Math.max(0, raw);
}

function utcMsFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map((v) => Number(v));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error(`Invalid YYYY-MM-DD date: ${ymd}`);
  }
  return Date.UTC(y, m - 1, d);
}

export function utcCalendarYmdFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Days on lot: from purchase to sale date if sold, otherwise to `referenceDate` (UTC calendar).
 */
export function computeLotDays(
  datePurchased: string,
  dateSold: string | null,
  referenceDate: Date,
): number {
  const endYmd = isNonEmptyYmd(dateSold) ? String(dateSold).trim() : utcCalendarYmdFromDate(referenceDate);
  return calendarDaysBetweenUtcYmd(datePurchased, endYmd);
}

export function lotDaysColor(days: number): LotDaysColor {
  if (days < 30) return 'green';
  if (days <= 60) return 'yellow';
  return 'red';
}
