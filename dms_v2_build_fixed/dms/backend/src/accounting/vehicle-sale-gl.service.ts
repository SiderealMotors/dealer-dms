import { Decimal } from '@prisma/client/runtime/library';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JournalStatus, Prisma, VehicleStatus } from '@prisma/client';
import {
  centsToDecimalString,
  decimalLikeToCents,
  decimalLikeToCentsOrNull,
  inventoryHstCentsOnPreTaxBase,
  purchaseTaxAndTotalFromPreTaxCents,
} from '../../lib/inventory-calculations';
import type { VehicleMoneyFields } from '../common/vehicle-profit-input';
import { PrismaService } from '../prisma/prisma.service';
import { VEHICLE_SALE_TRANSACTION_OPTIONS } from './vehicle-sale-transaction';

/** Must match seeded / configured chart of accounts. */
export const GL_ACCOUNT_CODES = {
  CASH: '1000',
  ACCOUNTS_RECEIVABLE: '1150',
  VEHICLE_INVENTORY: '1200',
  HST_RECEIVABLE: '1300',
  HST_PAYABLE: '2200',
  VEHICLE_SALES_REVENUE: '4000',
  COGS: '5000',
} as const;

const HST_RATE = 0.13;

/** Pre-tax sale proceeds in integer cents (aligned with {@link computeVehicleProfitFromCents} revenue line). */
export function vehicleSaleRevenueCents(v: VehicleMoneyFields): MoneyCents {
  return (
    (decimalLikeToCentsOrNull(v.sellingPrice) ?? 0n) +
    (decimalLikeToCentsOrNull(v.safetyCharge) ?? 0n) +
    (decimalLikeToCentsOrNull(v.warrantyCharge) ?? 0n) +
    (decimalLikeToCentsOrNull(v.omvicFee) ?? 0n)
  );
}

/** Full acquisition cost basis in integer cents (aligned with {@link computeVehicleProfitFromCents} cost line). */
export function vehicleAcquisitionCostCents(v: VehicleMoneyFields): MoneyCents {
  const purchaseCents = decimalLikeToCents(v.purchasePrice);
  const { totalPurchaseCents } = purchaseTaxAndTotalFromPreTaxCents(purchaseCents);

  const safetyCostCents = decimalLikeToCents(v.safetyCost);
  const gasCostCents = decimalLikeToCents(v.gas);
  const warrantyCostCents = decimalLikeToCents(v.warrantyCost);
  const safetyTaxCents = inventoryHstCentsOnPreTaxBase(safetyCostCents);
  const gasTaxCents = inventoryHstCentsOnPreTaxBase(gasCostCents);
  const warrantyTaxCents = inventoryHstCentsOnPreTaxBase(warrantyCostCents);

  const floorplanCents = decimalLikeToCents(v.floorplanInterestCost);
  const referralCents = decimalLikeToCents(v.referralAmount);

  return (
    totalPurchaseCents +
    safetyCostCents +
    safetyTaxCents +
    floorplanCents +
    gasCostCents +
    gasTaxCents +
    warrantyCostCents +
    warrantyTaxCents +
    referralCents
  );
}

export function vehicleSaleRevenueDecimalString(v: VehicleMoneyFields): string {
  return centsToDecimalString(vehicleSaleRevenueCents(v));
}

export function vehicleAcquisitionCostDecimalString(v: VehicleMoneyFields): string {
  return centsToDecimalString(vehicleAcquisitionCostCents(v));
}

/** Cash vs A/R: financing-style payments post to Accounts Receivable; everything else defaults to Cash. */
export function useCashForPayment(paymentMethod: string | null | undefined): boolean {
  if (paymentMethod == null || !String(paymentMethod).trim()) {
    return true;
  }
  const p = paymentMethod.toLowerCase();
  if (
    /financ|finance|loan|lease|receivable|\bar\b|borrowed|owed|terms|credit\s*union/i.test(p)
  ) {
    return false;
  }
  return true;
}

@Injectable()
export class VehicleSaleGlService {
  private readonly log = new Logger(VehicleSaleGlService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Posts two balanced, POSTED journal entries for a sold vehicle (revenue + COGS/inventory),
   * idempotent via `Vehicle.glRevenueJournalId` / `glCogsJournalId`.
   *
   * **Transactional contract:** all writes use `tx`. Call only from inside
   * `prisma.$transaction` (use `runVehicleSaleDbTransaction` for sale flows) together with
   * vehicle sale persistence so failures roll back inventory and journals together.
   */
  async postVehicleSaleJournals(
    tx: Prisma.TransactionClient,
    vehicleId: string,
  ): Promise<{ revenueEntryId: string | null; cogsEntryId: string | null }> {
    const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new BadRequestException(`Vehicle ${vehicleId} not found`);
    }
    if (vehicle.dateSold == null && vehicle.status !== VehicleStatus.SOLD) {
      return { revenueEntryId: null, cogsEntryId: null };
    }

    if (vehicle.glRevenueJournalId && vehicle.glCogsJournalId) {
      return { revenueEntryId: vehicle.glRevenueJournalId, cogsEntryId: vehicle.glCogsJournalId };
    }

    const codes = Object.values(GL_ACCOUNT_CODES);
    const accounts = await tx.glAccount.findMany({
      where: { code: { in: codes }, isActive: true },
    });
    const byCode = new Map(accounts.map((a) => [a.code, a]));
    for (const code of codes) {
      if (!byCode.has(code)) {
        throw new BadRequestException(
          `GL account ${code} is missing or inactive — run seed or create chart of accounts`,
        );
      }
    }

    const revenueCents = vehicleSaleRevenueCents(vehicle);
    const costCents = vehicleAcquisitionCostCents(vehicle);

    if (revenueCents <= 0n && costCents <= 0n) {
      this.log.warn(
        `Skipping vehicle sale GL for ${vehicleId}: no revenue and no acquisition cost computed`,
      );
      return { revenueEntryId: null, cogsEntryId: null };
    }

    const entryDate = vehicle.dateSold ?? new Date();
    const vinTag = vehicle.vin.length >= 6 ? vehicle.vin.slice(-6) : vehicle.vin;
    const titleBase = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

    let revenueEntryId: string | null = vehicle.glRevenueJournalId;
    let cogsEntryId: string | null = vehicle.glCogsJournalId;

    if (revenueCents > 0n && !revenueEntryId) {
      const cashOrAr = useCashForPayment(vehicle.paymentMethod)
        ? byCode.get(GL_ACCOUNT_CODES.CASH)!
        : byCode.get(GL_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE)!;
      const rev = byCode.get(GL_ACCOUNT_CODES.VEHICLE_SALES_REVENUE)!;
      const hstPayable = byCode.get(GL_ACCOUNT_CODES.HST_PAYABLE);
      const amt = new Decimal(centsToDecimalString(revenueCents));

      // HST on the full taxable amount (sellingPrice + safetyCharge + warrantyCharge + omvicFee)
      const hstCents = BigInt(Math.round(Number(revenueCents) * HST_RATE));
      const hstAmt = new Decimal(centsToDecimalString(hstCents));
      const totalWithHst = new Decimal(centsToDecimalString(revenueCents + hstCents));

      const revenueLines: any[] = [
        {
          lineNumber: 1,
          accountId: cashOrAr.id,
          debitAmount: hstPayable ? totalWithHst : amt,
          creditAmount: new Decimal(0),
          memo: useCashForPayment(vehicle.paymentMethod) ? 'Cash received from buyer' : 'Accounts receivable',
        },
        {
          lineNumber: 2,
          accountId: rev.id,
          debitAmount: new Decimal(0),
          creditAmount: amt,
          memo: 'Vehicle sales revenue (pre-tax)',
        },
      ];

      // Post HST collected to HST Payable (2200) if account exists
      if (hstPayable && hstCents > 0n) {
        revenueLines.push({
          lineNumber: 3,
          accountId: hstPayable.id,
          debitAmount: new Decimal(0),
          creditAmount: hstAmt,
          memo: 'HST collected (13%) — owing to CRA',
        });
      }

      const entry = await tx.journalEntry.create({
        data: {
          entryDate,
          description: `Vehicle sale — ${titleBase} (${vinTag})`,
          memo: `Auto: sale · VIN ${vehicle.vin}`,
          status: JournalStatus.POSTED,
          postedAt: new Date(),
          vehicleId: vehicle.id,
          lines: { create: revenueLines },
        },
      });
      revenueEntryId = entry.id;
    }

    if (costCents > 0n && !cogsEntryId) {
      const cogs = byCode.get(GL_ACCOUNT_CODES.COGS)!;
      const inv = byCode.get(GL_ACCOUNT_CODES.VEHICLE_INVENTORY)!;
      const amt = new Decimal(centsToDecimalString(costCents));

      const entry = await tx.journalEntry.create({
        data: {
          entryDate,
          description: `COGS / inventory — ${titleBase} (${vinTag})`,
          memo: `Auto: acquisition cost · VIN ${vehicle.vin}`,
          status: JournalStatus.POSTED,
          postedAt: new Date(),
          vehicleId: vehicle.id,
          lines: {
            create: [
              {
                lineNumber: 1,
                accountId: cogs.id,
                debitAmount: amt,
                creditAmount: new Decimal(0),
                memo: 'Cost of goods sold',
              },
              {
                lineNumber: 2,
                accountId: inv.id,
                debitAmount: new Decimal(0),
                creditAmount: amt,
                memo: 'Remove vehicle from inventory',
              },
            ],
          },
        },
      });
      cogsEntryId = entry.id;
    }

    const patch: Prisma.VehicleUpdateInput = {};
    if (revenueEntryId && revenueEntryId !== vehicle.glRevenueJournalId) {
      patch.glRevenueJournalId = revenueEntryId;
    }
    if (cogsEntryId && cogsEntryId !== vehicle.glCogsJournalId) {
      patch.glCogsJournalId = cogsEntryId;
    }
    if (Object.keys(patch).length > 0) {
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: patch,
      });
    }

    return { revenueEntryId, cogsEntryId };
  }

  /** For use outside an existing transaction (e.g. manual repair). */
  async postVehicleSaleJournalsStandalone(vehicleId: string) {
    return this.prisma.$transaction(
      async (tx) => this.postVehicleSaleJournals(tx, vehicleId),
      VEHICLE_SALE_TRANSACTION_OPTIONS,
    );
  }
}
