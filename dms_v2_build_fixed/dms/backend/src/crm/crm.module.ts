import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { AuditModule } from '../audit/audit.module';
import { CrmTasksController } from './crm-tasks.controller';
import { CrmTasksService } from './crm-tasks.service';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [AccountingModule, AuditModule],
  controllers: [CustomersController, LeadsController, DealsController, CrmTasksController],
  providers: [CustomersService, LeadsService, DealsService, CrmTasksService],
  exports: [CustomersService, LeadsService, DealsService, CrmTasksService],
})
export class CrmModule {}
