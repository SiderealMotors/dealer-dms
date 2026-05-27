import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { AccountingReportsService } from './accounting-reports.service';
import { AccountingService } from './accounting.service';
import { GeneralLedgerService } from './general-ledger.service';
import { GlAccountsService } from './gl-accounts.service';
import { JournalEntriesService } from './journal-entries.service';
import { VehicleSaleGlService } from './vehicle-sale-gl.service';

@Module({
  controllers: [AccountingController],
  providers: [
    AccountingService,
    GlAccountsService,
    JournalEntriesService,
    GeneralLedgerService,
    VehicleSaleGlService,
    AccountingReportsService,
  ],
  exports: [VehicleSaleGlService, AccountingReportsService],
})
export class AccountingModule {}
