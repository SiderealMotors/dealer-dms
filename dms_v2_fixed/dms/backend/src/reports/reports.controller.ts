import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { AccountingReportsService } from '../accounting/accounting-reports.service';
import { BalanceSheetQueryDto } from '../accounting/dto/balance-sheet.query.dto';
import { IncomeStatementQueryDto } from '../accounting/dto/income-statement.query.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { buildBalanceSheetCsv } from './balance-sheet-csv';
import { buildIncomeStatementCsv } from './income-statement-csv';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: AccountingReportsService) {}

  @Get('balance-sheet')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  async balanceSheet(
    @Query() query: BalanceSheetQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.reports.balanceSheet(query);
    if (query.format === 'csv') {
      const csv = buildBalanceSheetCsv({
        basis: data.basis,
        asOf: data.asOf,
        assets: data.assets.map((r) => ({
          accountId: r.accountId,
          code: r.code,
          name: r.name,
          amount: r.amount,
        })),
        liabilities: data.liabilities.map((r) => ({
          accountId: r.accountId,
          code: r.code,
          name: r.name,
          amount: r.amount,
        })),
        equityAccounts: data.equity.accounts.map((r) => ({
          accountId: r.accountId,
          code: r.code,
          name: r.name,
          amount: r.amount,
        })),
        netIncome: data.equity.netIncome,
        totals: data.totals,
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="balance_sheet_${data.asOf}.csv"`,
      );
      res.send(Buffer.from(csv, 'utf-8'));
      return;
    }
    return data;
  }

  @Get('income-statement')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  async incomeStatement(
    @Query() query: IncomeStatementQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.reports.incomeStatement(query);
    if (query.format === 'csv') {
      const csv = buildIncomeStatementCsv({
        basis: data.basis,
        startDate: data.startDate,
        endDate: data.endDate,
        revenue: data.revenue.map((r) => ({
          accountId: r.accountId,
          code: r.code,
          name: r.name,
          amount: r.amount,
        })),
        costOfGoodsSold: data.costOfGoodsSold.map((r) => ({
          accountId: r.accountId,
          code: r.code,
          name: r.name,
          amount: r.amount,
        })),
        operatingExpenses: data.operatingExpenses.map((r) => ({
          accountId: r.accountId,
          code: r.code,
          name: r.name,
          amount: r.amount,
        })),
        totals: data.totals,
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="income_statement_${data.startDate}_${data.endDate}.csv"`,
      );
      res.send(Buffer.from(csv, 'utf-8'));
      return;
    }
    return data;
  }
}
