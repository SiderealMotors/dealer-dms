import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditEntityType, CustomerVehicleRole, DealStage, Prisma, VehicleStatus } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { buildDealCreateAudit, diffDealAudit } from '../audit/audit.utils';
import { AuthContext } from '../auth/auth.service';
import { VehicleSaleGlService } from '../accounting/vehicle-sale-gl.service';
import { runVehicleSaleDbTransaction } from '../accounting/vehicle-sale-transaction';
import { resolveListPagination } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { decimalToDecimalString } from './crm.utils';
import { CreateDealDto } from './dto/create-deal.dto';
import { ListDealsQueryDto } from './dto/list-deals.query.dto';
import { UpdateDealDto } from './dto/update-deal.dto';

const dealListInclude = {
  customer: { select: { id: true, fullName: true, email: true, phone: true } },
  vehicle: {
    select: { id: true, vin: true, year: true, make: true, model: true },
  },
  _count: { select: { tasks: true } },
} as const;

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicleSaleGl: VehicleSaleGlService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll(query: ListDealsQueryDto) {
    const where: Prisma.DealWhereInput = {};
    if (query.customerId) {
      where.customerId = query.customerId;
    }
    if (query.vehicleId) {
      where.vehicleId = query.vehicleId;
    }
    if (query.stage) {
      where.stage = query.stage;
    }
    const { take, skip } = resolveListPagination(query);
    const rows = await this.prisma.deal.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
      include: dealListInclude,
    });
    return rows.map((d) => this.serializeDeal(d));
  }

  async findOne(id: string) {
    const row = await this.prisma.deal.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: {
          select: {
            id: true,
            vin: true,
            year: true,
            make: true,
            model: true,
            status: true,
            dateSold: true,
            buyerName: true,
          },
        },
        tasks: { orderBy: { dueAt: 'asc' } },
      },
    });
    if (!row) {
      throw new NotFoundException(`Deal ${id} not found`);
    }
    return this.serializeDeal(row);
  }

  async create(dto: CreateDealDto, auth: AuthContext | null) {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) {
      throw new NotFoundException(`Customer ${dto.customerId} not found`);
    }
    const stage = dto.stage ?? DealStage.OPEN;
    if (dto.vehicleId) {
      const v = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
      if (!v) {
        throw new NotFoundException(`Vehicle ${dto.vehicleId} not found`);
      }
      if (stage !== DealStage.CLOSED_WON) {
        await this.assertVehicleOpenForActiveDeal(dto.vehicleId);
      }
    }
    if (stage === DealStage.CLOSED_WON) {
      if (!dto.vehicleId) {
        throw new BadRequestException('Assign a vehicle before closing a deal as won');
      }
      await this.assertVehicleOpenForActiveDeal(dto.vehicleId);
      const closedAt = new Date();
      return runVehicleSaleDbTransaction(this.prisma, async (tx) => {
        const row = await tx.deal.create({
          data: {
            customerId: dto.customerId,
            vehicleId: dto.vehicleId,
            title: dto.title,
            value: dto.value != null ? dto.value : undefined,
            notes: dto.notes,
            stage: DealStage.CLOSED_WON,
            closedAt,
          },
          include: dealListInclude,
        });
        await this.applyClosedWonInventory(tx, row.id, closedAt);
        const full = await tx.deal.findUnique({
          where: { id: row.id },
          include: dealListInclude,
        });
        if (!full) {
          throw new NotFoundException(`Deal ${row.id} not found`);
        }
        await this.auditLog.append(tx, {
          entityType: AuditEntityType.DEAL,
          entityId: row.id,
          auth,
          changes: buildDealCreateAudit(full),
        });
        return this.serializeDeal(full);
      });
    }

    const row = await this.prisma.deal.create({
      data: {
        customerId: dto.customerId,
        vehicleId: dto.vehicleId,
        title: dto.title,
        value: dto.value != null ? dto.value : undefined,
        notes: dto.notes,
        stage,
      },
      include: dealListInclude,
    });
    await this.auditLog.append(this.prisma, {
      entityType: AuditEntityType.DEAL,
      entityId: row.id,
      auth,
      changes: buildDealCreateAudit(row),
    });
    return this.serializeDeal(row);
  }

  async update(id: string, dto: UpdateDealDto, auth: AuthContext | null) {
    const existing = await this.prisma.deal.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Deal ${id} not found`);
    }

    const nextVehicleId = dto.vehicleId !== undefined ? dto.vehicleId : existing.vehicleId;
    const nextStage = dto.stage ?? existing.stage;

    if (nextVehicleId && nextStage !== DealStage.CLOSED_WON && nextStage !== DealStage.CLOSED_LOST) {
      await this.assertVehicleOpenForActiveDeal(nextVehicleId);
    }

    const becomesWon = nextStage === DealStage.CLOSED_WON && existing.stage !== DealStage.CLOSED_WON;

    if (becomesWon) {
      if (!nextVehicleId) {
        throw new BadRequestException('Assign a vehicle before closing this deal as won');
      }
      await this.assertVehicleOpenForActiveDeal(nextVehicleId);

      const closedAt =
        dto.closedAt != null && dto.closedAt !== ''
          ? new Date(dto.closedAt)
          : new Date();

      return runVehicleSaleDbTransaction(this.prisma, async (tx) => {
        const data = this.buildDealUpdateInput(dto, {
          forceStage: DealStage.CLOSED_WON,
          closedAt,
        });
        await tx.deal.update({
          where: { id },
          data,
        });
        await this.applyClosedWonInventory(tx, id, closedAt);
        const full = await tx.deal.findUnique({
          where: { id },
          include: dealListInclude,
        });
        if (!full) {
          throw new NotFoundException(`Deal ${id} not found`);
        }
        const changes = diffDealAudit(existing, full);
        await this.auditLog.append(tx, {
          entityType: AuditEntityType.DEAL,
          entityId: id,
          auth,
          changes,
        });
        return this.serializeDeal(full);
      });
    }

    const data = this.buildDealUpdateInput(dto, {});
    const row = await this.prisma.deal.update({
      where: { id },
      data,
      include: dealListInclude,
    });
    const changes = diffDealAudit(existing, row);
    await this.auditLog.append(this.prisma, {
      entityType: AuditEntityType.DEAL,
      entityId: id,
      auth,
      changes,
    });
    return this.serializeDeal(row);
  }

  async remove(id: string) {
    await this.ensureDeal(id);
    await this.prisma.deal.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private buildDealUpdateInput(
    dto: UpdateDealDto,
    opts: { forceStage?: DealStage; closedAt?: Date | null },
  ): Prisma.DealUpdateInput {
    const data: Prisma.DealUpdateInput = {};
    if (dto.vehicleId !== undefined) {
      data.vehicleId = dto.vehicleId;
    }
    if (dto.title !== undefined) {
      data.title = dto.title;
    }
    if (dto.value !== undefined) {
      data.value = dto.value;
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes;
    }
    if (opts.forceStage !== undefined) {
      data.stage = opts.forceStage;
    } else if (dto.stage !== undefined) {
      data.stage = dto.stage;
    }
    if (opts.closedAt !== undefined) {
      data.closedAt = opts.closedAt;
    } else if (dto.closedAt !== undefined) {
      data.closedAt = dto.closedAt ? new Date(dto.closedAt) : null;
    }
    return data;
  }

  private async assertVehicleOpenForActiveDeal(vehicleId: string): Promise<void> {
    const v = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!v) {
      throw new NotFoundException(`Vehicle ${vehicleId} not found`);
    }
    if (v.status === VehicleStatus.SOLD || v.dateSold != null) {
      throw new ConflictException('This vehicle is sold and cannot be linked to an active deal');
    }
  }

  /**
   * Marks the deal's vehicle sold, upserts the buyer CustomerVehicle row, and posts sale journals.
   * Must run inside `runVehicleSaleDbTransaction` so inventory + GL commit together.
   */
  private async applyClosedWonInventory(
    tx: Prisma.TransactionClient,
    dealId: string,
    closedAt: Date,
  ): Promise<void> {
    const deal = await tx.deal.findUnique({
      where: { id: dealId },
      include: { customer: true },
    });
    if (!deal) {
      throw new NotFoundException(`Deal ${dealId} not found`);
    }
    if (!deal.vehicleId) {
      throw new BadRequestException('Deal must reference a vehicle to complete the sale');
    }

    const otherWon = await tx.deal.findFirst({
      where: {
        vehicleId: deal.vehicleId,
        stage: DealStage.CLOSED_WON,
        NOT: { id: dealId },
      },
      select: { id: true },
    });
    if (otherWon) {
      throw new ConflictException('Another deal is already closed won for this vehicle');
    }

    const vehicle = await tx.vehicle.findUnique({ where: { id: deal.vehicleId } });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${deal.vehicleId} not found`);
    }
    if (vehicle.status === VehicleStatus.SOLD || vehicle.dateSold != null) {
      throw new ConflictException('Vehicle is already marked sold in inventory');
    }

    const dateSold = new Date(
      Date.UTC(closedAt.getUTCFullYear(), closedAt.getUTCMonth(), closedAt.getUTCDate()),
    );

    await tx.vehicle.update({
      where: { id: vehicle.id },
      data: {
        status: VehicleStatus.SOLD,
        dateSold,
        buyerName: deal.customer.fullName,
        sellingPrice: deal.value ?? undefined,
      },
    });

    await tx.customerVehicle.upsert({
      where: {
        customerId_vehicleId: {
          customerId: deal.customerId,
          vehicleId: deal.vehicleId,
        },
      },
      create: {
        customerId: deal.customerId,
        vehicleId: deal.vehicleId,
        role: CustomerVehicleRole.BUYER,
      },
      update: { role: CustomerVehicleRole.BUYER },
    });

    await this.vehicleSaleGl.postVehicleSaleJournals(tx, vehicle.id);
  }

  private async ensureDeal(id: string): Promise<void> {
    const d = await this.prisma.deal.findUnique({ where: { id }, select: { id: true } });
    if (!d) {
      throw new NotFoundException(`Deal ${id} not found`);
    }
  }

  private serializeDeal(row: any) {
    const value = decimalToDecimalString(row.value);
    const closedAt = row.closedAt ? row.closedAt.toISOString().slice(0, 10) : null;
    return {
      ...row,
      value,
      closedAt,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
