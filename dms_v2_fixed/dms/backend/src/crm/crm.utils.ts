import { Prisma } from '@prisma/client';
import { prismaDecimalToDecimalString, prismaDecimalToNumber } from '../common/prisma-decimal';

export function decimalToDecimalString(v: Prisma.Decimal | null | undefined): string | null {
  return prismaDecimalToDecimalString(v);
}

/** @deprecated Prefer {@link decimalToDecimalString} for API output. */
export function decimalToNumber(v: Prisma.Decimal | null | undefined): number | null {
  return prismaDecimalToNumber(v);
}

export function parseDateOnly(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((n) => Number(n));
  return new Date(Date.UTC(y, m - 1, d));
}
