import { Decimal } from '@prisma/client/runtime/library';
import { Injectable, NotFoundException } from '@nestjs/common';
import { JournalStatus, NormalBalance, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decimalToDecimalString, netBalanceFromSums } from './accounting.utils';
import { GeneralLedgerQueryDto } from './dto/general-ledger.query.dto';
import { TrialBalanceQueryDto } from './dto/trial-balance.query.dto';

@Injectable()
export class GeneralLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async ledgerForAccount(query: GeneralLedgerQueryDto) {
    const account = await this.prisma.glAccount.findUnique({ where: { id: query.accountId } });
    if (!account) {
      throw new NotFoundException(`GL account ${query.accountId} not found`);
    }

    let opening = new Decimal(0);
    if (query.from) {
      const priorLines = await this.prisma.journalLine.findMany({
        where: {
          accountId: query.accountId,
          journalEntry: {
            status: JournalStatus.POSTED,
            entryDate: { lt: new Date(query.from) },
          },
        },
      });
      opening = this.netBalanceForLines(account.normalBalance, priorLines);
    }

    const entryDateFilter: any = {};
    if (query.from) {
      entryDateFilter.gte = new Date(query.from);
    }
    if (query.to) {
      entryDateFilter.lte = new Date(query.to);
    }

    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId: query.accountId,
        journalEntry: {
          status: JournalStatus.POSTED,
          ...(Object.keys(entryDateFilter).length > 0 ? { entryDate: entryDateFilter } : {}),
        },
      },
      orderBy: [
        { journalEntry: { entryDate: 'asc' } },
        { journalEntry: { entryNum: 'asc' } },
        { lineNumber: 'asc' },
      ],
      include: {
        journalEntry: {
          select: {
            id: true,
            entryNum: true,
            entryDate: true,
            description: true,
            memo: true,
          },
        },
      },
    });

    let running = opening;
    const detail = lines.map((l) => {
      const delta = this.lineDelta(account.normalBalance, l.debitAmount, l.creditAmount);
      running = running.plus(delta);
      return {
        journalEntryId: l.journalEntryId,
        journalLineId: l.id,
        entryNum: l.journalEntry.entryNum,
        entryDate: l.journalEntry.entryDate.toISOString().slice(0, 10),
        description: l.journalEntry.description,
        memo: l.journalEntry.memo,
        debitAmount: decimalToDecimalString(l.debitAmount)!,
        creditAmount: decimalToDecimalString(l.creditAmount)!,
        balance: decimalToDecimalString(running)!,
      };
    });

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        normalBalance: account.normalBalance,
      },
      from: query.from ?? null,
      to: query.to ?? null,
      openingBalance: decimalToDecimalString(opening),
      lines: detail,
      closingBalance: decimalToDecimalString(running),
    };
  }

  async trialBalance(query: TrialBalanceQueryDto) {
    const asOf = query.asOf ? new Date(query.asOf) : new Date();
    const lines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          status: JournalStatus.POSTED,
          entryDate: { lte: asOf },
        },
      },
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            normalBalance: true,
          },
        },
      },
    });

    const agg = new Map<
      string,
      {
        account: {
          id: string;
          code: string;
          name: string;
          type: string;
          normalBalance: NormalBalance;
        };
        debits: Decimal;
        credits: Decimal;
      }
    >();

    let sumDr = new Decimal(0);
    let sumCr = new Decimal(0);

    for (const l of lines) {
      sumDr = sumDr.plus(l.debitAmount);
      sumCr = sumCr.plus(l.creditAmount);
      const id = l.accountId;
      if (!agg.has(id)) {
        agg.set(id, {
          account: l.account,
          debits: new Decimal(0),
          credits: new Decimal(0),
        });
      }
      const row = agg.get(id)!;
      row.debits = row.debits.plus(l.debitAmount);
      row.credits = row.credits.plus(l.creditAmount);
    }

    const accounts = [...agg.values()]
      .sort((a, b) => a.account.code.localeCompare(b.account.code))
      .map((r) => ({
        accountId: r.account.id,
        code: r.account.code,
        name: r.account.name,
        type: r.account.type,
        normalBalance: r.account.normalBalance,
        debitTotal: decimalToDecimalString(r.debits)!,
        creditTotal: decimalToDecimalString(r.credits)!,
      }));

    return {
      asOf: asOf.toISOString().slice(0, 10),
      accounts,
      totals: {
        debits: decimalToDecimalString(sumDr)!,
        credits: decimalToDecimalString(sumCr)!,
        balanced: sumDr.equals(sumCr),
      },
    };
  }

  private netBalanceForLines(
    normal: NormalBalance,
    lines: { debitAmount: Decimal; creditAmount: Decimal }[],
  ): Decimal {
    let t = new Decimal(0);
    for (const l of lines) {
      t = t.plus(this.lineDelta(normal, l.debitAmount, l.creditAmount));
    }
    return t;
  }

  private lineDelta(
    normal: NormalBalance,
    debit: Decimal,
    credit: Decimal,
  ): Decimal {
    return netBalanceFromSums(normal, debit, credit);
  }
}
