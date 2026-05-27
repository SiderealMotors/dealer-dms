import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { AuditModule } from '../audit/audit.module';
import { InventoryCalculationsService } from './services/inventory-calculations.service';
import { VehiclesController } from './vehicles/vehicles.controller';
import { VehiclesService } from './vehicles/vehicles.service';

@Module({
  imports: [AccountingModule, AuditModule],
  controllers: [VehiclesController],
  providers: [InventoryCalculationsService, VehiclesService],
  exports: [InventoryCalculationsService, VehiclesService],
})
export class InventoryModule {}
