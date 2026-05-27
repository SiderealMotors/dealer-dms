import { Decimal } from '@prisma/client/runtime/library';
import { BadRequestException } from '@nestjs/common';
import { NormalBalance, Prisma } from '@prisma/client';
import { prismaDecimalToDecimalString, prismaDecimalToNumber } from '../common/prisma-decimal';

export function toDecimal(n: number | string | Decimal): Decimal {
  return new Decimal(String(n));
}

/** Net GL balance from cumulative debits/credits using the account’s normal balance (trial balance / BS). */
export function netBalanceFromSums(
  normal: NormalBalance,
  debitSum: Decimal,
  creditSum: Decimal,
): Decimal {
  if (normal === NormalBalance.DEBIT) {
    return debitSum.minus(creditSum);
  }
  return creditSum.minus(debitSum);
}

export function sumJournalLines(
  lines: { debitAmount: Decimal; creditAmount: Decimal }[],
): { debits: Decimal; credits: Decimal } {
  let debits = new Decimal(0);
  let credits = new Decimal(0);
  for (const l of lines) {
    debits = debits.plus(l.debitAmount);
    credits = credits.plus(l.creditAmount);
  }
  return { debits, credits };
}

export function assertJournalBalanced(
  lines: { debitAmount: Decimal; creditAmount: Decimal }[],
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
