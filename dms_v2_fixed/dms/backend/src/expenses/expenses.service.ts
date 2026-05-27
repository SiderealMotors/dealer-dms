import { Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseCategory, JournalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesQueryDto } from './dto/list-expenses.query.dto';

const HST_RATE = 0.13;

/** Map expense categories to default GL account codes (must match seeded chart of accounts). */
const CATEGORY_GL_MAP: Record<ExpenseCategory, string> = {
  ADVERTISING: '6100',
  BANK_CHARGES: '6200',
  FLOORPLAN_INTEREST: '6300',
  INSURANCE: '6400',
  OFFICE_SUPPLIES: '6500',
  OMVIC_FEES: '6600',
  RENT: '6700',
  REPAIRS_MAINTENANCE: '6800',
  SALARIES_WAGES: '6900',
  UTILITIES: '7000',
  VEHICLE_PURCHASE: '1200',
  OTHER: '7100',
};

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateExpenseDto) {
    const amountPreTax = Number(dto.amountPreTax);
    const hstAmount = dto.hstAmount != null ? Number(dto.hstAmount) : 0;
    const totalAmount = amountPreTax + hstAmount;

    // Resolve GL account
    let glAccountId = dto.glAccountId;
    if (!glAccountId) {
      const code = CATEGORY_GL_MAP[dto.category];
      const acct = await this.prisma.glAccount.findFirst({ where: { code, isActive: true } });
      if (acct) glAccountId = acct.id;
    }

    // Auto-post journal entry if GL account found
    let journalEntryId: string | undefined;
    if (glAccountId) {
      const cashAcct = await this.prisma.glAccount.findFirst({ where: { code: '1000' } });
      const hstPaidAcct = await this.prisma.glAccount.findFirst({ where: { code: '1300' } });

      if (cashAcct) {
        const lines: Prisma.JournalLineCreateManyJournalEntryInput[] = [
          {
            lineNumber: 1,
            accountId: glAccountId,
            debitAmount: new Prisma.Decimal(amountPreTax.toFixed(2)),
            creditAmount: new Prisma.Decimal(0),
            memo: dto.description,
          },
        ];

        let lineNum = 2;

        // HST paid (input tax credit) if applicable
        if (hstAmount > 0 && hstPaidAcct) {
          lines.push({
            lineNumber: lineNum++,
            accountId: hstPaidAcct.id,
            debitAmount: new Prisma.Decimal(hstAmount.toFixed(2)),
            creditAmount: new Prisma.Decimal(0),
            memo: 'HST input tax credit',
          });
        }

        // Credit Cash
        lines.push({
          lineNumber: lineNum,
          accountId: cashAcct.id,
          debitAmount: new Prisma.Decimal(0),
          creditAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
          memo: dto.vendor ?? dto.description,
        });

        const je = await this.prisma.journalEntry.create({
          data: {
            entryDate: new Date(dto.date),
            description: `${dto.category.replace(/_/g, ' ')} — ${dto.description}`,
            memo: dto.vendor,
            status: JournalStatus.POSTED,
            postedAt: new Date(),
            vehicleId: dto.vehicleId ?? null,
            lines: { createMany: { data: lines } },
          },
        });
        journalEntryId = je.id;
      }
    }

    return this.prisma.expense.create({
      data: {
        date: new Date(dto.date),
        category: dto.category,
        vendor: dto.vendor,
        description: dto.description,
        amountPreTax: new Prisma.Decimal(amountPreTax.toFixed(2)),
        hstAmount: new Prisma.Decimal(hstAmount.toFixed(2)),
        totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
        receiptUrl: dto.receiptUrl,
        glAccountId: glAccountId ?? null,
        journalEntryId: journalEntryId ?? null,
        vehicleId: dto.vehicleId ?? null,
      },
      include: { glAccount: true, vehicle: { select: { id: true, year: true, make: true, model: true, vin: true } } },
    });
  }

  async list(query: ListExpensesQueryDto) {
    const where: Prisma.ExpenseWhereInput = { deletedAt: null };

    if (query.from) where.date = { ...((where.date as any) ?? {}), gte: new Date(query.from) };
    if (query.to) where.date = { ...((where.date as any) ?? {}), lte: new Date(query.to) };
    if (query.category) where.category = query.category;
    if (query.vehicleId) where.vehicleId = query.vehicleId;

    const limit = Math.min(query.limit ?? 50, 200);
    const offset = query.offset ?? 0;

    const [items, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: {
          glAccount: { select: { code: true, name: true } },
          vehicle: { select: { id: true, year: true, make: true, model: true } },
        },
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return { items, total, offset, limit };
  }

  async summary(from: string, to: string) {
    const where: Prisma.ExpenseWhereInput = {
      deletedAt: null,
      date: { gte: new Date(from), lte: new Date(to) },
    };

    const rows = await this.prisma.expense.groupBy({
      by: ['category'],
      where,
      _sum: { totalAmount: true, hstAmount: true, amountPreTax: true },
    });

    const totalExpenses = rows.reduce(
      (sum, r) => sum + Number(r._sum.totalAmount ?? 0),
      0,
    );
    const totalHst = rows.reduce(
      (sum, r) => sum + Number(r._sum.hstAmount ?? 0),
      0,
    );

    return {
      from,
      to,
      byCategory: rows.map((r) => ({
        category: r.category,
        amountPreTax: Number(r._sum.amountPreTax ?? 0).toFixed(2),
        hstAmount: Number(r._sum.hstAmount ?? 0).toFixed(2),
        totalAmount: Number(r._sum.totalAmount ?? 0).toFixed(2),
      })),
      totals: {
        amountPreTax: (totalExpenses - totalHst).toFixed(2),
        hstAmount: totalHst.toFixed(2),
        totalAmount: totalExpenses.toFixed(2),
      },
    };
  }

  async remove(id: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, deletedAt: null } });
    if (!expense) throw new NotFoundException('Expense not found');
    await this.prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  async hstSummary(from: string, to: string) {
    const dateWhere = { gte: new Date(from), lte: new Date(to) };

    // HST collected on vehicle sales (from posted journals on revenue accounts)
    const hstCollectedAcct = await this.prisma.glAccount.findFirst({ where: { code: '2200' } });
    const hstPaidAcct = await this.prisma.glAccount.findFirst({ where: { code: '1300' } });

    let hstCollected = 0;
    let hstPaid = 0;

    if (hstCollectedAcct) {
      const res = await this.prisma.journalLine.aggregate({
        where: {
          accountId: hstCollectedAcct.id,
          journalEntry: { status: 'POSTED', entryDate: dateWhere },
        },
        _sum: { creditAmount: true },
      });
      hstCollected = Number(res._sum.creditAmount ?? 0);
    }

    if (hstPaidAcct) {
      const res = await this.prisma.journalLine.aggregate({
        where: {
          accountId: hstPaidAcct.id,
          journalEntry: { status: 'POSTED', entryDate: dateWhere },
        },
        _sum: { debitAmount: true },
      });
      hstPaid = Number(res._sum.debitAmount ?? 0);
    }

    // Also sum HST from expense records
    const expenseHst = await this.prisma.expense.aggregate({
      where: { deletedAt: null, date: dateWhere },
      _sum: { hstAmount: true },
    });
    const expenseHstPaid = Number(expenseHst._sum.hstAmount ?? 0);

    const netOwing = hstCollected - (hstPaid + expenseHstPaid);

    return {
      from,
      to,
      hstCollected: hstCollected.toFixed(2),
      hstPaid: (hstPaid + expenseHstPaid).toFixed(2),
      netOwing: netOwing.toFixed(2),
    };
  }
}
