import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { ReportsController } from './reports.controller';

@Module({
  imports: [AccountingModule],
  controllers: [ReportsController],
})
export class ReportsModule {}
