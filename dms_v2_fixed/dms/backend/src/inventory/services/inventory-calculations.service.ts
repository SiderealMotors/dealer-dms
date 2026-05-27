import { Injectable } from '@nestjs/common';
import {
  computeVehicleInventorySnapshot,
  computeVehicleProfitFromCents,
  type VehicleDateInput,
  type VehicleMoneyCentsInput,
  type VehicleProfitCentsInput,
} from '../../lib/inventory-calculations';

/**
 * Nest adapter over the shared calculation package — controllers must not import math directly.
 */
@Injectable()
export class InventoryCalculationsService {
  computeSnapshot(
    dates: VehicleDateInput,
    nums: VehicleMoneyCentsInput,
    referenceDate: Date = new Date(),
  ) {
    return computeVehicleInventorySnapshot(dates, nums, referenceDate);
  }

  computeProfit(input: VehicleProfitCentsInput) {
    return computeVehicleProfitFromCents(input);
  }
}
