import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AccountingReportsService } from './accounting-reports.service';
import { AccountingService } from './accounting.service';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { GeneralLedgerService } from './general-ledger.service';
import { GlAccountsService } from './gl-accounts.service';
import { JournalEntriesService } from './journal-entries.service';
import { CreateGlAccountDto } from './dto/create-gl-account.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { GeneralLedgerQueryDto } from './dto/general-ledger.query.dto';
import { ListGlAccountsQueryDto } from './dto/list-gl-accounts.query.dto';
import { ListJournalEntriesQueryDto } from './dto/list-journal-entries.query.dto';
import { TrialBalanceQueryDto } from './dto/trial-balance.query.dto';
import { UpdateGlAccountDto } from './dto/update-gl-account.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';
import { AccountingDateRangeQueryDto, VehicleProfitReportQueryDto } from './dto/accounting-reports.query.dto';

@Controller('accounting')
@UseGuards(JwtAuthGuard)
export class AccountingController {
  constructor(
    private readonly accounting: AccountingService,
    private readonly glAccounts: GlAccountsService,
    private readonly journalEntries: JournalEntriesService,
    private readonly generalLedger: GeneralLedgerService,
    private readonly reports: AccountingReportsService,
  ) {}

  @Get('vehicles/:vehicleId/ledger')
  listForVehicle(@Param('vehicleId') vehicleId: string) {
    return this.accounting.listForVehicle(vehicleId);
  }

  @Post('ledger')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  createVehicleLedgerEntry(@Body() dto: CreateLedgerEntryDto) {
    return this.accounting.createEntry(dto);
  }

  @Get('accounts')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  listGlAccounts(@Query() query: ListGlAccountsQueryDto) {
    return this.glAccounts.findAll(query);
  }

  @Post('accounts')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  createGlAccount(@Body() dto: CreateGlAccountDto) {
    return this.glAccounts.create(dto);
  }

  @Get('accounts/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  getGlAccount(@Param('id') id: string) {
    return this.glAccounts.findOne(id);
  }

  @Patch('accounts/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  updateGlAccount(@Param('id') id: string, @Body() dto: UpdateGlAccountDto) {
    return this.glAccounts.update(id, dto);
  }

  @Get('journal-entries')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  listJournalEntries(@Query() query: ListJournalEntriesQueryDto) {
    return this.journalEntries.list(query);
  }

  @Get('journal-entries/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  getJournalEntry(@Param('id') id: string) {
    return this.journalEntries.findOne(id);
  }

  @Post('journal-entries')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  createJournalEntry(@Body() dto: CreateJournalEntryDto) {
    return this.journalEntries.create(dto);
  }

  @Patch('journal-entries/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  updateJournalEntry(@Param('id') id: string, @Body() dto: UpdateJournalEntryDto) {
    return this.journalEntries.update(id, dto);
  }

  @Delete('journal-entries/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  deleteJournalEntry(@Param('id') id: string) {
    return this.journalEntries.remove(id);
  }

  @Post('journal-entries/:id/post')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  postJournalEntry(@Param('id') id: string) {
    return this.journalEntries.post(id);
  }

  @Get('general-ledger')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  getGeneralLedger(@Query() query: GeneralLedgerQueryDto) {
    return this.generalLedger.ledgerForAccount(query);
  }

  @Get('trial-balance')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  trialBalance(@Query() query: TrialBalanceQueryDto) {
    return this.generalLedger.trialBalance(query);
  }

  @Get('reports/profit-loss')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  profitAndLoss(@Query() query: AccountingDateRangeQueryDto) {
    return this.reports.profitAndLoss(query);
  }

  @Get('reports/vehicle-profit')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  vehicleProfitReport(@Query() query: VehicleProfitReportQueryDto) {
    return this.reports.vehicleProfitReport(query);
  }

  @Get('reports/monthly')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  monthlySummaries(@Query() query: AccountingDateRangeQueryDto) {
    return this.reports.monthlySummaries(query);
  }
}
