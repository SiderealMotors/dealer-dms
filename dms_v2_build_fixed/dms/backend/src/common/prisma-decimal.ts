import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';

/** Stable 2-decimal string from Decimal (no binary float). */
export function prismaDecimalToDecimalString(v: Decimal | null | undefined): string | null {
  if (v == null) {
    return null;
  }
  return v.toFixed(2);
}

/**
 * @deprecated Prefer {@link prismaDecimalToDecimalString} for API output.
 * For calculation pipelines use `decimalLikeToCents` from `@dms/inventory-calculations`.
 */
export function prismaDecimalToNumber(v: Decimal | null | undefined): number | null {
  const s = prismaDecimalToDecimalString(v);
  return s == null ? null : Number(s);
}
