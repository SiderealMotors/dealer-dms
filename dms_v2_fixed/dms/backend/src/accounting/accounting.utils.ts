import { BadRequestException } from '@nestjs/common';
import { NormalBalance, Prisma } from '@prisma/client';
import { prismaDecimalToDecimalString, prismaDecimalToNumber } from '../common/prisma-decimal';

export function toDecimal(n: number | string | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(String(n));
}

/** Net GL balance from cumulative debits/credits using the account’s normal balance (trial balance / BS). */
export function netBalanceFromSums(
  normal: NormalBalance,
  debitSum: Prisma.Decimal,
  creditSum: Prisma.Decimal,
): Prisma.Decimal {
  if (normal === NormalBalance.DEBIT) {
    return debitSum.minus(creditSum);
  }
  return creditSum.minus(debitSum);
}

export function sumJournalLines(
  lines: { debitAmount: Prisma.Decimal; creditAmount: Prisma.Decimal }[],
): { debits: Prisma.Decimal; credits: Prisma.Decimal } {
  let debits = new Prisma.Decimal(0);
  let credits = new Prisma.Decimal(0);
  for (const l of lines) {
    debits = debits.plus(l.debitAmount);
    credits = credits.plus(l.creditAmount);
  }
  return { debits, credits };
}

export function assertJournalBalanced(
  lines: { debitAmount: Prisma.Decimal; creditAmount: Prisma.Decimal }[],
): void {
  const { debits, credits } = sumJournalLines(lines);
  if (!debits.equals(credits)) {
    throw new BadRequestException(
      `Debits must equal credits (got debits ${debits.toFixed(2)} vs credits ${credits.toFixed(2)})`,
    );
  }
}

export { prismaDecimalToDecimalString as decimalToDecimalString };
export { prismaDecimalToNumber as decimalToNumber };
