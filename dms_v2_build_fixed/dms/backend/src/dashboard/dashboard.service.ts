import { Injectable } from '@nestjs/common';
import { VehicleStatus } from '@prisma/client';
import { centsToDecimalString, INVENTORY_HST_PERCENT_POINTS } from '../../lib/inventory-calculations';
import { PrismaService } from '../prisma/prisma.service';
import { inventoryFinancialsAggregateSql } from './dashboard-inventory-financials.sql';

function toBigIntCents(v: unknown): bigint {
  if (typeof v === 'bigint') {
    return v;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return BigInt(Math.trunc(v));
  }
  if (typeof v === 'string' && v.trim() !== '') {
    return BigInt(v.split('.')[0]!);
  }
  return 0n;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async inventorySummary() {
    const grouped = await this.prisma.vehicle.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    let available = 0;
    let pending = 0;
    let sold = 0;
    let total = 0;
    for (const g of grouped) {
      const c = g._count._all;
      total += c;
      if (g.status === VehicleStatus.AVAILABLE) {
        available = c;
      } else if (g.status === VehicleStatus.PENDING) {
        pending = c;
      } else if (g.status === VehicleStatus.SOLD) {
        sold = c;
      }
    }

    const [row] = await this.prisma.$queryRaw<
      Array<{
        realizedProfitCents: unknown;
        soldRevenueCents: unknown;
        soldCostCents: unknown;
        inventoryCapitalCents: unknown;
      }>
    >(inventoryFinancialsAggregateSql(INVENTORY_HST_PERCENT_POINTS));

    const realizedProfitCents = toBigIntCents(row?.realizedProfitCents);
    const soldRevenueCents = toBigIntCents(row?.soldRevenueCents);
    const soldCostCents = toBigIntCents(row?.soldCostCents);
    const inventoryCapitalCents = toBigIntCents(row?.inventoryCapitalCents);

    return {
      counts: { total, available, pending, sold },
      financials: {
        /** Sum of per-unit profit for sold vehicles with a complete sale bundle (matches inventory engine). */
        realizedProfit: centsToDecimalString(realizedProfitCents),
        totalProfit: centsToDecimalString(realizedProfitCents),
        /** Pre-tax sale bundle (selling + charges) for sold, complete rows only. */
        totalRevenue: centsToDecimalString(soldRevenueCents),
        /** Full acquisition-style cost basis for sold, complete rows only. */
        totalCosts: centsToDecimalString(soldCostCents),
        /** Purchase + purchase HST tied up in unsold units or sold rows missing a complete sale bundle. */
        inventoryCapitalAtCost: centsToDecimalString(inventoryCapitalCents),
      },
    };
  }
}
