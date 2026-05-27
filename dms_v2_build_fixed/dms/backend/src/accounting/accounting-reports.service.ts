import { sql } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AccountType, JournalStatus, Prisma } from '@prisma/client';
import {
  centsToDecimalString,
  computeVehicleProfitFromCents,
  parseFixed2DecimalMoneyString,
} from '../../lib/inventory-calculations';
import { vehicleToProfitCentsInput } from '../common/vehicle-profit-input';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingDateRangeQueryDto, VehicleProfitReportQueryDto } from './dto/accounting-reports.query.dto';
import { BalanceSheetQueryDto } from './dto/balance-sheet.query.dto';
import { IncomeStatementQueryDto } from './dto/income-statement.query.dto';
import { netBalanceFromSums } from './accounting.utils';
import {
  GL_ACCOUNT_CODES,
  vehicleAcquisitionCostCents,
  vehicleAcquisitionCostDecimalString,
  vehicleSaleRevenueCents,
  vehicleSaleRevenueDecimalString,
} from './vehicle-sale-gl.service';

const MAX_REPORT_RANGE_MS = 1000 * 60 * 60 * 24 * 365 * 5;

function parseRange(from: string, to: string): { fromDate: Date; toDate: Date } {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new BadRequestException('Invalid date range');
  }
  if (fromDate > toDate) {
    throw new BadRequestException('"from" must be on or before "to"');
  }
  if (toDate.getTime() - fromDate.getTime() > MAX_REPORT_RANGE_MS) {
    throw new BadRequestException('Date range cannot exceed 5 years');
  }
  return { fromDate, toDate };
}

function monthKeysInclusive(fromYmd: string, toYmd: string): string[] {
  const [fy, fm] = fromYmd.split('-').map((n) => Number(n));
  const [ty, tm] = toYmd.split('-').map((n) => Number(n));
  const keys: string[] = [];
  let y = fy;
  let m = fm;
  const end = ty * 100 + tm;
  while (y * 100 + m <= end) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

function monthKeyFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  return `${y}-${String(mo).padStart(2, '0')}`;
}

type IncomeStatementLineRow = {
  accountId: string;
  code: string;
  name: string;
  amount: string;
};

type BalanceSheetLineRow = {
  accountId: string;
  code: string;
  name: string;
  amount: string;
};

@Injectable()
export class AccountingReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Posted GL income statement: revenue, COGS (expense account {@link GL_ACCOUNT_CODES.COGS}),
   * operating expenses (other EXPENSE), gross profit, net profit.
   *
   * For the same calendar `from`/`to` as {@link profitAndLoss}, `totals.netProfit` here equals
   * `totals.netIncome` there (all expenses roll up consistently).
   */
  async incomeStatement(query: IncomeStatementQueryDto) {
    const { from, to } = this.resolveIncomeStatementDateRange(query);
    const { fromDate, toDate } = parseRange(from, to);

    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          status: JournalStatus.POSTED,
          entryDate: { gte: fromDate, lte: toDate },
        },
      },
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
    });

    if (grouped.length === 0) {
      return {
        basis: 'gl' as const,
        startDate: from,
        endDate: to,
        revenue: [] as IncomeStatementLineRow[],
        costOfGoodsSold: [] as IncomeStatementLineRow[],
        operatingExpenses: [] as IncomeStatementLineRow[],
        totals: {
          totalRevenue: '0.00',
          totalCostOfGoodsSold: '0.00',
          grossProfit: '0.00',
          totalExpenses: '0.00',
          netProfit: '0.00',
        },
      };
    }

    const accounts = await this.prisma.glAccount.findMany({
      where: {
        id: { in: grouped.map((g) => g.accountId) },
        type: { in: [AccountType.REVENUE, AccountType.EXPENSE] },
      },
    });
    const accountById = new Map(accounts.map((a) => [a.id, a]));

    const revenueRows: IncomeStatementLineRow[] = [];
    const cogsRows: IncomeStatementLineRow[] = [];
    const operatingExpenseRows: IncomeStatementLineRow[] = [];

    let totalRevenueCents = 0n;
    let totalCogsCents = 0n;
    let totalOperatingExpensesCents = 0n;

    const cogsCode = GL_ACCOUNT_CODES.COGS;

    for (const g of grouped) {
      const acc = accountById.get(g.accountId);
      if (!acc) {
        continue;
      }
      const dr = g._sum.debitAmount ?? new Decimal(0);
      const cr = g._sum.creditAmount ?? new Decimal(0);

      if (acc.type === AccountType.REVENUE) {
        const lineCents = parseFixed2DecimalMoneyString(cr.minus(dr).toFixed(2));
        totalRevenueCents += lineCents;
        revenueRows.push({
          accountId: acc.id,
          code: acc.code,
          name: acc.name,
          amount: centsToDecimalString(lineCents),
        });
      } else if (acc.type === AccountType.EXPENSE) {
        const lineCents = parseFixed2DecimalMoneyString(dr.minus(cr).toFixed(2));
        const row: IncomeStatementLineRow = {
          accountId: acc.id,
          code: acc.code,
          name: acc.name,
          amount: centsToDecimalString(lineCents),
        };
        if (acc.code === cogsCode) {
          totalCogsCents += lineCents;
          cogsRows.push(row);
        } else {
          totalOperatingExpensesCents += lineCents;
          operatingExpenseRows.push(row);
        }
      }
    }

    revenueRows.sort((a, b) => a.code.localeCompare(b.code));
    cogsRows.sort((a, b) => a.code.localeCompare(b.code));
    operatingExpenseRows.sort((a, b) => a.code.localeCompare(b.code));

    const grossProfitCents = totalRevenueCents - totalCogsCents;
    const netProfitCents = grossProfitCents - totalOperatingExpensesCents;

    return {
      basis: 'gl' as const,
      startDate: from,
      endDate: to,
      revenue: revenueRows,
      costOfGoodsSold: cogsRows,
      operatingExpenses: operatingExpenseRows,
      totals: {
        totalRevenue: centsToDecimalString(totalRevenueCents),
        totalCostOfGoodsSold: centsToDecimalString(totalCogsCents),
        grossProfit: centsToDecimalString(grossProfitCents),
        totalExpenses: centsToDecimalString(totalOperatingExpensesCents),
        netProfit: centsToDecimalString(netProfitCents),
      },
    };
  }

  private resolveIncomeStatementDateRange(query: IncomeStatementQueryDto): { from: string; to: string } {
    const today = new Date();
    const todayYmd = today.toISOString().slice(0, 10);

    if (query.startDate && query.endDate) {
      return { from: query.startDate, to: query.endDate };
    }
    if (query.startDate && !query.endDate) {
      return { from: query.startDate, to: todayYmd };
    }
    if (!query.startDate && query.endDate) {
      const ey = new Date(`${query.endDate}T12:00:00.000Z`).getUTCFullYear();
      return { from: `${ey}-01-01`, to: query.endDate };
    }
    const y = today.getUTCFullYear();
    return { from: `${y}-01-01`, to: todayYmd };
  }

  /**
   * Balance sheet as of a date: chart-classified ASSET / LIABILITY / EQUITY, plus P&L (REVENUE − EXPENSE)
   * rolled into equity so **Assets = Liabilities + Equity** matches double-entry before closing entries.
   */
  async balanceSheet(query: BalanceSheetQueryDto) {
    const asOfDate = query.asOf ? new Date(query.asOf) : new Date();
    if (Number.isNaN(asOfDate.getTime())) {
      throw new BadRequestException('Invalid asOf date');
    }
    const asOfYmd = query.asOf?.slice(0, 10) ?? asOfDate.toISOString().slice(0, 10);

    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          status: JournalStatus.POSTED,
          entryDate: { lte: asOfDate },
        },
      },
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
    });

    if (grouped.length === 0) {
      return {
        basis: 'gl' as const,
        asOf: asOfYmd,
        assets: [] as BalanceSheetLineRow[],
        liabilities: [] as BalanceSheetLineRow[],
        equity: {
          accounts: [] as BalanceSheetLineRow[],
          netIncome: { name: 'Net income (P&L through as-of)', amount: '0.00' },
        },
        totals: {
          assets: '0.00',
          liabilities: '0.00',
          equity: '0.00',
          equityFromAccounts: '0.00',
          netIncome: '0.00',
          balanced: true,
        },
      };
    }

    const accounts = await this.prisma.glAccount.findMany({
      where: { id: { in: grouped.map((g) => g.accountId) } },
    });
    const accountById = new Map(accounts.map((a) => [a.id, a]));

    const assetRows: BalanceSheetLineRow[] = [];
    const liabilityRows: BalanceSheetLineRow[] = [];
    const equityRows: BalanceSheetLineRow[] = [];

    let totalAssetsCents = 0n;
    let totalLiabilitiesCents = 0n;
    let totalEquityAccountsCents = 0n;
    let totalRevenueCents = 0n;
    let totalExpensesCents = 0n;

    for (const g of grouped) {
      const acc = accountById.get(g.accountId);
      if (!acc) {
        continue;
      }
      const dr = g._sum.debitAmount ?? new Decimal(0);
      const cr = g._sum.creditAmount ?? new Decimal(0);
      const bal = netBalanceFromSums(acc.normalBalance, dr, cr);
      const lineCents = parseFixed2DecimalMoneyString(bal.toFixed(2));
      const lineAmount = centsToDecimalString(lineCents);

      const line: BalanceSheetLineRow = {
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        amount: lineAmount,
      };

      switch (acc.type) {
        case AccountType.ASSET:
          assetRows.push(line);
          totalAssetsCents += lineCents;
          break;
        case AccountType.LIABILITY:
          liabilityRows.push(line);
          totalLiabilitiesCents += lineCents;
          break;
        case AccountType.EQUITY:
          equityRows.push(line);
          totalEquityAccountsCents += lineCents;
          break;
        case AccountType.REVENUE:
          totalRevenueCents += lineCents;
          break;
        case AccountType.EXPENSE:
          totalExpensesCents += lineCents;
          break;
        default:
          break;
      }
    }

    assetRows.sort((a, b) => a.code.localeCompare(b.code));
    liabilityRows.sort((a, b) => a.code.localeCompare(b.code));
    equityRows.sort((a, b) => a.code.localeCompare(b.code));

    const netIncomeCents = totalRevenueCents - totalExpensesCents;
    const totalEquityCents = totalEquityAccountsCents + netIncomeCents;

    const balanced =
      totalAssetsCents === totalLiabilitiesCents + totalEquityCents;

    return {
      basis: 'gl' as const,
      asOf: asOfYmd,
      assets: assetRows,
      liabilities: liabilityRows,
      equity: {
        accounts: equityRows,
        netIncome: {
          name: 'Net income (P&L through as-of)',
          amount: centsToDecimalString(netIncomeCents),
        },
      },
      totals: {
        assets: centsToDecimalString(totalAssetsCents),
        liabilities: centsToDecimalString(totalLiabilitiesCents),
        equity: centsToDecimalString(totalEquityCents),
        equityFromAccounts: centsToDecimalString(totalEquityAccountsCents),
        netIncome: centsToDecimalString(netIncomeCents),
        balanced,
      },
    };
  }

  /**
   * Profit & Loss from posted GL activity (revenue & expense accounts) for the period.
   */
  async profitAndLoss(query: AccountingDateRangeQueryDto) {
    const { fromDate, toDate } = parseRange(query.from, query.to);

    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          status: JournalStatus.POSTED,
          entryDate: { gte: fromDate, lte: toDate },
        },
      },
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
    });

    if (grouped.length === 0) {
      return {
        basis: 'gl' as const,
        from: query.from,
        to: query.to,
        revenue: [],
        expenses: [],
        totals: {
          revenue: '0.00',
          expenses: '0.00',
          netIncome: '0.00',
        },
      };
    }

    const accounts = await this.prisma.glAccount.findMany({
      where: {
        id: { in: grouped.map((g) => g.accountId) },
        type: { in: [AccountType.REVENUE, AccountType.EXPENSE] },
      },
    });
    const accountById = new Map(accounts.map((a) => [a.id, a]));

    const revenueRows: {
      accountId: string;
      code: string;
      name: string;
      amount: string;
    }[] = [];
    const expenseRows: typeof revenueRows = [];

    let totalRevenueCents = 0n;
    let totalExpensesCents = 0n;

    for (const g of grouped) {
      const acc = accountById.get(g.accountId);
      if (!acc) {
        continue;
      }
      const dr = g._sum.debitAmount ?? new Decimal(0);
      const cr = g._sum.creditAmount ?? new Decimal(0);
      if (acc.type === AccountType.REVENUE) {
        const lineCents = parseFixed2DecimalMoneyString(cr.minus(dr).toFixed(2));
        totalRevenueCents += lineCents;
        revenueRows.push({
          accountId: acc.id,
          code: acc.code,
          name: acc.name,
          amount: centsToDecimalString(lineCents),
        });
      } else if (acc.type === AccountType.EXPENSE) {
        const lineCents = parseFixed2DecimalMoneyString(dr.minus(cr).toFixed(2));
        totalExpensesCents += lineCents;
        expenseRows.push({
          accountId: acc.id,
          code: acc.code,
          name: acc.name,
          amount: centsToDecimalString(lineCents),
        });
      }
    }

    revenueRows.sort((a, b) => a.code.localeCompare(b.code));
    expenseRows.sort((a, b) => a.code.localeCompare(b.code));

    const netCents = totalRevenueCents - totalExpensesCents;

    return {
      basis: 'gl' as const,
      from: query.from,
      to: query.to,
      revenue: revenueRows,
      expenses: expenseRows,
      totals: {
        revenue: centsToDecimalString(totalRevenueCents),
        expenses: centsToDecimalString(totalExpensesCents),
        netIncome: centsToDecimalString(netCents),
      },
    };
  }

  /**
   * Sold vehicles in range with per-unit revenue, cost, and profit (inventory profit engine).
   */
  async vehicleProfitReport(query: VehicleProfitReportQueryDto) {
    const { fromDate, toDate } = parseRange(query.from, query.to);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const where = {
      dateSold: { gte: fromDate, lte: toDate },
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.vehicle.count({ where }),
      this.prisma.vehicle.findMany({
        where,
        orderBy: { dateSold: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items = rows.map((v) => {
      const revenue = vehicleSaleRevenueDecimalString(v);
      const cost = vehicleAcquisitionCostDecimalString(v);
      const profitResult = computeVehicleProfitFromCents(vehicleToProfitCentsInput(v));

      const profit = profitResult.success === true ? profitResult.profit : null;

      return {
        vehicleId: v.id,
        vin: v.vin,
        year: v.year,
        make: v.make,
        model: v.model,
        dateSold: v.dateSold!.toISOString().slice(0, 10),
        revenue,
        acquisitionCost: cost,
        profit,
        profitStatus: profitResult.success ? 'ok' : profitResult.code,
      };
    });

    return {
      basis: 'inventory' as const,
      from: query.from,
      to: query.to,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
      items,
    };
  }

  /**
   * Monthly rollups: vehicle sales (profit engine) + GL net by month (single query per source).
   */
  async monthlySummaries(query: AccountingDateRangeQueryDto) {
    const { fromDate, toDate } = parseRange(query.from, query.to);
    const monthKeys = monthKeysInclusive(query.from.slice(0, 7), query.to.slice(0, 7));

    const sold = await this.prisma.vehicle.findMany({
      where: {
        dateSold: { gte: fromDate, lte: toDate },
      },
      select: {
        dateSold: true,
        purchasePrice: true,
        safetyCost: true,
        gas: true,
        warrantyCost: true,
        floorplanInterestCost: true,
        referralAmount: true,
        sellingPrice: true,
        safetyCharge: true,
        warrantyCharge: true,
        omvicFee: true,
      },
    });

    const vehicleByMonth = new Map<
      string,
      { units: number; revenueCents: bigint; costCents: bigint; profitCents: bigint }
    >();
    for (const k of monthKeys) {
      vehicleByMonth.set(k, { units: 0, revenueCents: 0n, costCents: 0n, profitCents: 0n });
    }

    for (const v of sold) {
      if (!v.dateSold) {
        continue;
      }
      const key = monthKeyFromDate(v.dateSold);
      if (!vehicleByMonth.has(key)) {
        continue;
      }
      const bucket = vehicleByMonth.get(key)!;
      bucket.units += 1;
      bucket.revenueCents += vehicleSaleRevenueCents(v);
      bucket.costCents += vehicleAcquisitionCostCents(v);
      const pr = computeVehicleProfitFromCents(vehicleToProfitCentsInput(v));
      if (pr.success) {
        bucket.profitCents += pr.profitCents;
      }
    }

    const glByMonth = await this.prisma.$queryRaw(
      sql`
        SELECT
          date_trunc('month', je."entryDate")::date AS month,
          COALESCE(SUM(CASE WHEN a."type" = 'REVENUE' THEN jl."creditAmount" - jl."debitAmount" ELSE 0 END), 0) AS net_revenue,
          COALESCE(SUM(CASE WHEN a."type" = 'EXPENSE' THEN jl."debitAmount" - jl."creditAmount" ELSE 0 END), 0) AS net_expense
        FROM "JournalLine" jl
        INNER JOIN "JournalEntry" je ON je."id" = jl."journalEntryId"
        INNER JOIN "GlAccount" a ON a."id" = jl."accountId"
        WHERE je."status" = 'POSTED'
          AND je."entryDate" >= ${fromDate}::date
          AND je."entryDate" <= ${toDate}::date
          AND a."type" IN ('REVENUE', 'EXPENSE')
        GROUP BY 1
        ORDER BY 1 ASC
      `,
    ) as { month: Date; net_revenue: Decimal; net_expense: Decimal }[];

    const glMap = new Map<
      string,
      { glRevenue: string; glExpenses: string; glNetIncome: string }
    >();
    for (const row of glByMonth) {
      const k = monthKeyFromDate(new Date(row.month));
      const revCents = parseFixed2DecimalMoneyString(row.net_revenue.toFixed(2));
      const expCents = parseFixed2DecimalMoneyString(row.net_expense.toFixed(2));
      glMap.set(k, {
        glRevenue: centsToDecimalString(revCents),
        glExpenses: centsToDecimalString(expCents),
        glNetIncome: centsToDecimalString(revCents - expCents),
      });
    }

    const months = monthKeys.map((month) => {
      const v = vehicleByMonth.get(month)!;
      const g = glMap.get(month);
      return {
        month,
        vehiclesSold: v.units,
        vehicleRevenue: centsToDecimalString(v.revenueCents),
        vehicleAcquisitionCost: centsToDecimalString(v.costCents),
        vehicleGrossProfit: centsToDecimalString(v.profitCents),
        glRevenue: g?.glRevenue ?? '0.00',
        glExpenses: g?.glExpenses ?? '0.00',
        glNetIncome: g?.glNetIncome ?? '0.00',
      };
    });

    let sumVehicleRevenueCents = 0n;
    let sumVehicleCostCents = 0n;
    let sumVehicleProfitCents = 0n;
    let sumGlRevCents = 0n;
    let sumGlExpCents = 0n;
    let sumGlNetCents = 0n;
    let vehiclesSold = 0;
    for (const m of months) {
      vehiclesSold += m.vehiclesSold;
      sumVehicleRevenueCents += parseFixed2DecimalMoneyString(m.vehicleRevenue);
      sumVehicleCostCents += parseFixed2DecimalMoneyString(m.vehicleAcquisitionCost);
      sumVehicleProfitCents += parseFixed2DecimalMoneyString(m.vehicleGrossProfit);
      sumGlRevCents += parseFixed2DecimalMoneyString(m.glRevenue);
      sumGlExpCents += parseFixed2DecimalMoneyString(m.glExpenses);
      sumGlNetCents += parseFixed2DecimalMoneyString(m.glNetIncome);
    }

    return {
      from: query.from,
      to: query.to,
      months,
      totals: {
        vehiclesSold,
        vehicleRevenue: centsToDecimalString(sumVehicleRevenueCents),
        vehicleAcquisitionCost: centsToDecimalString(sumVehicleCostCents),
        vehicleGrossProfit: centsToDecimalString(sumVehicleProfitCents),
        glRevenue: centsToDecimalString(sumGlRevCents),
        glExpenses: centsToDecimalString(sumGlExpCents),
        glNetIncome: centsToDecimalString(sumGlNetCents),
      },
    };
  }
}
