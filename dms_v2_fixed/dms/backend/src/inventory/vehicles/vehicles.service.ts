import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditEntityType, Prisma, Vehicle, VehicleStatus } from '@prisma/client';
import {
  centsToDecimalString,
  decimalLikeToCents,
  decimalLikeToCentsOrNull,
  finiteMoneyNumberToCents,
} from '../../lib/inventory-calculations';
import { AuditLogService } from '../../audit/audit-log.service';
import { diffVehicleAudit } from '../../audit/audit.utils';
import { AuthContext } from '../../auth/auth.service';
import { VehicleSaleGlService } from '../../accounting/vehicle-sale-gl.service';
import { runVehicleSaleDbTransaction } from '../../accounting/vehicle-sale-transaction';
import {
  DEFAULT_VEHICLE_LIST_LIMIT,
  MAX_VEHICLE_LIST_LIMIT,
  resolveListPagination,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryCalculationsService } from '../services/inventory-calculations.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { ListVehiclesQueryDto, VehicleStatusFilter } from './dto/list-vehicles.query.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import {
  validateCreateVehicleBusinessRules,
  validateUpdateVehicleBusinessRules,
} from '../validation/vehicle-business-rules';
import { buildInventoryCsv } from './vehicle-inventory-csv';
import type { VehicleWithComputed } from './vehicle-with-computed.types';

export type { VehicleWithComputed };
@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryCalculations: InventoryCalculationsService,
    private readonly vehicleSaleGl: VehicleSaleGlService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(dto: CreateVehicleDto): Promise<VehicleWithComputed> {
    validateCreateVehicleBusinessRules(dto);
    await this.ensureVinAvailable(dto.vin);
    try {
      const soldOnCreate = Boolean(dto.dateSold && String(dto.dateSold).trim());
      const row = await runVehicleSaleDbTransaction(this.prisma, async (tx) => {
        const created = await tx.vehicle.create({
          data: this.toCreateInput(dto),
          include: { salesPerson: true },
        });
        if (soldOnCreate) {
          await this.vehicleSaleGl.postVehicleSaleJournals(tx, created.id);
        }
        return created;
      });
      return this.serialize(row);
    } catch (err) {
      this.handlePrismaVehicleError(err);
    }
  }

  async findAll(query: ListVehiclesQueryDto): Promise<{
    items: VehicleWithComputed[];
    total: number;
    offset: number;
    limit: number;
  }> {
    const where = this.buildListWhere(query);
    const { take, skip } = resolveListPagination(query, {
      defaultLimit: DEFAULT_VEHICLE_LIST_LIMIT,
      maxLimit: MAX_VEHICLE_LIST_LIMIT,
    });
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.vehicle.count({ where }),
      this.prisma.vehicle.findMany({
        where,
        orderBy: { datePurchased: 'desc' },
        skip,
        take,
        include: { salesPerson: true },
      }),
    ]);
    return {
      items: rows.map((r) => this.serialize(r)),
      total,
      offset: skip,
      limit: take,
    };
  }

  /**
   * Full inventory export using the same filters as list; rows use {@link serialize} (centralized tax/profit/lot math).
   */
  async exportInventoryCsv(query: ListVehiclesQueryDto): Promise<string> {
    const where = this.buildListWhere(query);
    const rows = await this.prisma.vehicle.findMany({
      where,
      orderBy: { datePurchased: 'desc' },
      include: { salesPerson: true },
    });
    return buildInventoryCsv(rows.map((r) => this.serialize(r)));
  }

  private buildListWhere(query: ListVehiclesQueryDto): Prisma.VehicleWhereInput {
    const where: Prisma.VehicleWhereInput = {};
    if (query.status === VehicleStatusFilter.AVAILABLE) {
      where.dateSold = null;
      where.status = VehicleStatus.AVAILABLE;
    } else if (query.status === VehicleStatusFilter.PENDING) {
      where.dateSold = null;
      where.status = VehicleStatus.PENDING;
    } else if (query.status === VehicleStatusFilter.SOLD) {
      where.dateSold = { not: null };
    }
    if (query.salesPersonId) {
      where.salesPersonId = query.salesPersonId;
    }
    return where;
  }

  async findOne(id: string): Promise<VehicleWithComputed> {
    const row = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { salesPerson: true },
    });
    if (!row) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }
    return this.serialize(row);
  }

  async update(
    id: string,
    dto: UpdateVehicleDto,
    auth: AuthContext | null,
  ): Promise<VehicleWithComputed> {
    const existing = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }
    validateUpdateVehicleBusinessRules(existing, dto);
    if (dto.vin && dto.vin.toUpperCase() !== existing.vin.toUpperCase()) {
      await this.ensureVinAvailable(dto.vin);
    }
    try {
      const wasSold = existing.dateSold != null || existing.status === VehicleStatus.SOLD;

      const row = await runVehicleSaleDbTransaction(this.prisma, async (tx) => {
        await tx.vehicle.update({
          where: { id },
          data: this.toUpdateInput(dto, existing),
        });
        const afterWrite = await tx.vehicle.findUnique({ where: { id } });
        if (!afterWrite) {
          throw new NotFoundException(`Vehicle ${id} not found`);
        }
        const nowSold = afterWrite.dateSold != null || afterWrite.status === VehicleStatus.SOLD;
        if (!wasSold && nowSold) {
          await this.vehicleSaleGl.postVehicleSaleJournals(tx, id);
        }
        const final = await tx.vehicle.findUnique({
          where: { id },
          include: { salesPerson: true },
        });
        if (!final) {
          throw new NotFoundException(`Vehicle ${id} not found`);
        }
        const changes = diffVehicleAudit(existing, final);
        await this.auditLog.append(tx, {
          entityType: AuditEntityType.VEHICLE,
          entityId: id,
          auth,
          changes,
        });
        return final;
      });

      return this.serialize(row);
    } catch (err) {
      this.handlePrismaVehicleError(err);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.vehicle.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException(`Vehicle ${id} not found`);
      }
      throw err;
    }
  }

  private async ensureVinAvailable(vin: string): Promise<void> {
    const hit = await this.prisma.vehicle.findFirst({
      where: { vin: vin.toUpperCase() },
    });
    if (hit) {
      throw new ConflictException('VIN already exists');
    }
  }

  private toCreateInput(dto: CreateVehicleDto): Prisma.VehicleCreateInput {
    return {
      datePurchased: this.parseDateOnly(dto.datePurchased),
      vin: dto.vin.toUpperCase(),
      year: dto.year,
      make: dto.make,
      model: dto.model,
      trim: dto.trim,
      colour: dto.colour,
      odometer: dto.odometer,
      purchasePrice: this.toDbMoney(dto.purchasePrice),
      safetyEstimate:
        dto.safetyEstimate === undefined ? undefined : this.toDbMoney(dto.safetyEstimate),
      safetyCost: this.toDbMoney(dto.safetyCost ?? 0),
      floorplanInterestCost: this.toDbMoney(dto.floorplanInterestCost ?? 0),
      gas: this.toDbMoney(dto.gas ?? 0),
      warrantyCost: this.toDbMoney(dto.warrantyCost ?? 0),
      dateSold: dto.dateSold ? this.parseDateOnly(dto.dateSold) : undefined,
      sellingPrice: this.toDbMoneyOpt(dto.sellingPrice),
      safetyCharge: this.toDbMoneyOpt(dto.safetyCharge),
      warrantyCharge: this.toDbMoneyOpt(dto.warrantyCharge),
      omvicFee: this.toDbMoneyOpt(dto.omvicFee),
      buyerName: dto.buyerName ?? undefined,
      referralAmount: this.toDbMoney(dto.referralAmount ?? 0),
      paymentMethod: dto.paymentMethod ?? undefined,
      depositAmount: this.toDbMoneyOpt(dto.depositAmount),
      salesPerson: dto.salesPersonId
        ? { connect: { id: dto.salesPersonId } }
        : undefined,
      salesPersonName: dto.salesPersonName ?? undefined,
      status: this.computeVehicleStatusCreate(dto),
    };
  }

  private toUpdateInput(
    dto: UpdateVehicleDto,
    existing: Vehicle,
  ): Prisma.VehicleUpdateInput {
    const data: Prisma.VehicleUpdateInput = {};
    if (dto.datePurchased !== undefined) {
      data.datePurchased = this.parseDateOnly(dto.datePurchased);
    }
    if (dto.vin !== undefined) {
      data.vin = dto.vin.toUpperCase();
    }
    if (dto.year !== undefined) data.year = dto.year;
    if (dto.make !== undefined) data.make = dto.make;
    if (dto.model !== undefined) data.model = dto.model;
    if (dto.trim !== undefined) data.trim = dto.trim;
    if (dto.colour !== undefined) data.colour = dto.colour;
    if (dto.odometer !== undefined) data.odometer = dto.odometer;
    if (dto.purchasePrice !== undefined) data.purchasePrice = this.toDbMoney(dto.purchasePrice);
    if (dto.safetyEstimate !== undefined) {
      data.safetyEstimate =
        dto.safetyEstimate === null ? null : this.toDbMoney(dto.safetyEstimate);
    }
    if (dto.safetyCost !== undefined) data.safetyCost = this.toDbMoney(dto.safetyCost);
    if (dto.floorplanInterestCost !== undefined) {
      data.floorplanInterestCost = this.toDbMoney(dto.floorplanInterestCost);
    }
    if (dto.gas !== undefined) data.gas = this.toDbMoney(dto.gas);
    if (dto.warrantyCost !== undefined) data.warrantyCost = this.toDbMoney(dto.warrantyCost);
    if (dto.dateSold !== undefined) {
      data.dateSold = dto.dateSold ? this.parseDateOnly(dto.dateSold) : null;
    }
    if (dto.sellingPrice !== undefined) {
      data.sellingPrice =
        dto.sellingPrice === null || dto.sellingPrice === undefined
          ? null
          : this.toDbMoney(dto.sellingPrice);
    }
    if (dto.safetyCharge !== undefined) {
      data.safetyCharge =
        dto.safetyCharge === null || dto.safetyCharge === undefined
          ? null
          : this.toDbMoney(dto.safetyCharge);
    }
    if (dto.warrantyCharge !== undefined) {
      data.warrantyCharge =
        dto.warrantyCharge === null || dto.warrantyCharge === undefined
          ? null
          : this.toDbMoney(dto.warrantyCharge);
    }
    if (dto.omvicFee !== undefined) {
      data.omvicFee =
        dto.omvicFee === null || dto.omvicFee === undefined ? null : this.toDbMoney(dto.omvicFee);
    }
    if (dto.buyerName !== undefined) {
      data.buyerName = dto.buyerName ?? null;
    }
    if (dto.referralAmount !== undefined) {
      data.referralAmount = this.toDbMoney(dto.referralAmount);
    }
    if (dto.paymentMethod !== undefined) {
      data.paymentMethod = dto.paymentMethod ?? null;
    }
    if (dto.depositAmount !== undefined) {
      data.depositAmount =
        dto.depositAmount === null || dto.depositAmount === undefined
          ? null
          : this.toDbMoney(dto.depositAmount);
    }
    if (dto.salesPersonId !== undefined) {
      data.salesPerson = dto.salesPersonId
        ? { connect: { id: dto.salesPersonId } }
        : { disconnect: true };
    }
    if (dto.salesPersonName !== undefined) {
      data.salesPersonName = dto.salesPersonName ?? null;
    }

    data.status = this.computeVehicleStatus(existing, dto);

    return data;
  }

  private computeVehicleStatusCreate(dto: CreateVehicleDto): VehicleStatus {
    if (dto.dateSold && String(dto.dateSold).trim()) {
      return VehicleStatus.SOLD;
    }
    return dto.status === 'pending' ? VehicleStatus.PENDING : VehicleStatus.AVAILABLE;
  }

  private computeVehicleStatus(existing: Vehicle, dto: UpdateVehicleDto): VehicleStatus {
    const nextSold =
      dto.dateSold !== undefined
        ? dto.dateSold && String(dto.dateSold).trim()
          ? this.parseDateOnly(dto.dateSold)
          : null
        : existing.dateSold;

    if (nextSold) {
      return VehicleStatus.SOLD;
    }

    if (dto.status !== undefined) {
      return dto.status === 'pending' ? VehicleStatus.PENDING : VehicleStatus.AVAILABLE;
    }

    if (dto.dateSold !== undefined && !dto.dateSold?.trim()) {
      return VehicleStatus.AVAILABLE;
    }

    if (existing.status === VehicleStatus.SOLD) {
      return VehicleStatus.AVAILABLE;
    }

    return existing.status;
  }

  private serializeStatus(row: Vehicle): 'available' | 'pending' | 'sold' {
    if (row.dateSold != null || row.status === VehicleStatus.SOLD) {
      return 'sold';
    }
    return row.status === VehicleStatus.PENDING ? 'pending' : 'available';
  }

  private parseDateOnly(ymd: string): Date {
    const [y, m, d] = ymd.split('-').map((n) => Number(n));
    return new Date(Date.UTC(y, m - 1, d));
  }

  private toDbMoney(n: number): Prisma.Decimal {
    return new Prisma.Decimal(centsToDecimalString(finiteMoneyNumberToCents(n)));
  }

  private toDbMoneyOpt(
    n: number | null | undefined,
  ): Prisma.Decimal | null | undefined {
    if (n === undefined) {
      return undefined;
    }
    if (n === null) {
      return null;
    }
    return this.toDbMoney(n);
  }

  private serialize(
    row: Vehicle & {
      salesPerson?: { id: string; fullName: string; email: string } | null;
    },
  ): VehicleWithComputed {
    const datePurchased = this.formatDate(row.datePurchased);
    const dateSold = row.dateSold ? this.formatDate(row.dateSold) : null;

    const purchasePrice = centsToDecimalString(decimalLikeToCents(row.purchasePrice));
    const safetyCost = centsToDecimalString(decimalLikeToCents(row.safetyCost));
    const gas = centsToDecimalString(decimalLikeToCents(row.gas));
    const warrantyCost = centsToDecimalString(decimalLikeToCents(row.warrantyCost));
    const floorplanInterestCost = centsToDecimalString(decimalLikeToCents(row.floorplanInterestCost));
    const referralAmount = centsToDecimalString(decimalLikeToCents(row.referralAmount));

    const sellingPrice =
      row.sellingPrice == null ? null : centsToDecimalString(decimalLikeToCents(row.sellingPrice));
    const safetyCharge =
      row.safetyCharge == null ? null : centsToDecimalString(decimalLikeToCents(row.safetyCharge));
    const warrantyCharge =
      row.warrantyCharge == null ? null : centsToDecimalString(decimalLikeToCents(row.warrantyCharge));
    const omvicFee =
      row.omvicFee == null ? null : centsToDecimalString(decimalLikeToCents(row.omvicFee));

    const computed = this.inventoryCalculations.computeSnapshot(
      { datePurchased, dateSold },
      {
        purchasePriceCents: decimalLikeToCents(row.purchasePrice),
        safetyCostCents: decimalLikeToCents(row.safetyCost),
        gasCents: decimalLikeToCents(row.gas),
        warrantyCostCents: decimalLikeToCents(row.warrantyCost),
        floorplanInterestCents: decimalLikeToCents(row.floorplanInterestCost),
        referralCents: decimalLikeToCents(row.referralAmount),
        sellingPriceCents: decimalLikeToCentsOrNull(row.sellingPrice),
        safetyChargeCents: decimalLikeToCentsOrNull(row.safetyCharge),
        warrantyChargeCents: decimalLikeToCentsOrNull(row.warrantyCharge),
        omvicFeeCents: decimalLikeToCentsOrNull(row.omvicFee),
      },
      new Date(),
    );

    return {
      id: row.id,
      datePurchased,
      vin: row.vin,
      year: row.year,
      make: row.make,
      model: row.model,
      trim: row.trim,
      colour: row.colour,
      odometer: row.odometer,
      purchasePrice,
      taxCost: computed.taxCost,
      totalPurchasePrice: computed.totalPurchasePrice,
      safetyEstimate:
        row.safetyEstimate == null ? null : centsToDecimalString(decimalLikeToCents(row.safetyEstimate)),
      safetyCost,
      safetyTax: computed.safetyTax,
      floorplanInterestCost,
      gas,
      gasTax: computed.gasTax,
      warrantyCost,
      warrantyTax: computed.warrantyTax,
      dateSold,
      sellingPrice,
      safetyCharge,
      warrantyCharge,
      omvicFee,
      sellTax: computed.sellTax,
      buyerName: row.buyerName,
      referralAmount,
      paymentMethod: row.paymentMethod,
      depositAmount:
        row.depositAmount == null ? null : centsToDecimalString(decimalLikeToCents(row.depositAmount)),
      salesPersonId: row.salesPersonId,
      salesPersonName: row.salesPersonName,
      salesPerson: row.salesPerson
        ? {
            id: row.salesPerson.id,
            fullName: row.salesPerson.fullName,
            email: row.salesPerson.email,
          }
        : null,
      lotDays: computed.lotDays,
      lotDaysColor: computed.lotDaysColor,
      profit: computed.profit,
      status: this.serializeStatus(row),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /**
   * Normalize Prisma `Decimal` to a number with at most two decimal places before feeding calculators.
   * Avoids binary float drift from `toNumber()` on some values.
   */
  private handlePrismaVehicleError(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2003') {
        throw new BadRequestException('Invalid salesperson reference');
      }
    }
    throw err;
  }
}
