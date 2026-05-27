import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerVehicleRole, LeadStatus, Prisma, VehicleStatus } from '@prisma/client';
import { resolveListPagination } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsQueryDto } from './dto/list-leads.query.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListLeadsQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.customerId) {
      where.customerId = query.customerId;
    }
    const { take, skip } = resolveListPagination(query);
    return this.prisma.lead.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
      include: {
        customer: { select: { id: true, fullName: true, email: true, phone: true } },
        vehicle: { select: { id: true, vin: true, year: true, make: true, model: true } },
      },
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: { select: { id: true, vin: true, year: true, make: true, model: true, status: true } },
      },
    });
    if (!row) {
      throw new NotFoundException(`Lead ${id} not found`);
    }
    return row;
  }

  async create(dto: CreateLeadDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) {
      throw new NotFoundException(`Customer ${dto.customerId} not found`);
    }
    if (dto.vehicleId) {
      await this.assertVehicleAssignableToLead(dto.vehicleId);
    }

    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          fullName: dto.fullName,
          phone: dto.phone,
          email: dto.email,
          status: dto.status ?? LeadStatus.NEW_LEAD,
          source: dto.source,
          summary: dto.summary,
          customerId: dto.customerId,
          vehicleId: dto.vehicleId ?? null,
        },
        include: {
          customer: { select: { id: true, fullName: true } },
          vehicle: { select: { id: true, vin: true, year: true, make: true, model: true } },
        },
      });
      if (lead.vehicleId) {
        await this.ensureInterestedCustomerVehicle(tx, lead.customerId, lead.vehicleId);
      }
      return lead;
    });
  }

  async update(id: string, dto: UpdateLeadDto) {
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Lead ${id} not found`);
    }
    if (dto.customerId) {
      const c = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
      if (!c) {
        throw new NotFoundException(`Customer ${dto.customerId} not found`);
      }
    }
    const nextVehicleId = dto.vehicleId !== undefined ? dto.vehicleId : existing.vehicleId;
    if (nextVehicleId) {
      await this.assertVehicleAssignableToLead(nextVehicleId);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: dto as Prisma.LeadUpdateInput,
        include: {
          customer: { select: { id: true, fullName: true, email: true, phone: true } },
          vehicle: { select: { id: true, vin: true, year: true, make: true, model: true } },
        },
      });

      const prevC = existing.customerId;
      const prevV = existing.vehicleId;
      const newC = updated.customerId;
      const newV = updated.vehicleId;

      if (prevV && (prevV !== newV || prevC !== newC)) {
        await this.removeInterestedCustomerVehicle(tx, prevC, prevV);
      }
      if (newV) {
        await this.ensureInterestedCustomerVehicle(tx, newC, newV);
      }

      return updated;
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Lead ${id} not found`);
    }
    await this.prisma.$transaction(async (tx) => {
      if (existing.vehicleId) {
        await this.removeInterestedCustomerVehicle(tx, existing.customerId, existing.vehicleId);
      }
      await tx.lead.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }

  private async assertVehicleAssignableToLead(vehicleId: string): Promise<void> {
    const v = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!v) {
      throw new NotFoundException(`Vehicle ${vehicleId} not found`);
    }
    if (v.status === VehicleStatus.SOLD || v.dateSold != null) {
      throw new ConflictException('Sold vehicles cannot be assigned to a lead');
    }
  }

  private async ensureInterestedCustomerVehicle(
    tx: Prisma.TransactionClient,
    customerId: string,
    vehicleId: string,
  ): Promise<void> {
    const v = await tx.vehicle.findUnique({ where: { id: vehicleId } });
    if (!v) {
      throw new NotFoundException(`Vehicle ${vehicleId} not found`);
    }
    if (v.status === VehicleStatus.SOLD || v.dateSold != null) {
      throw new ConflictException('Sold vehicles cannot be assigned to a lead');
    }

    const link = await tx.customerVehicle.findUnique({
      where: { customerId_vehicleId: { customerId, vehicleId } },
    });
    if (!link) {
      await tx.customerVehicle.create({
        data: {
          customerId,
          vehicleId,
          role: CustomerVehicleRole.INTERESTED,
        },
      });
    }
  }

  private async removeInterestedCustomerVehicle(
    tx: Prisma.TransactionClient,
    customerId: string,
    vehicleId: string,
  ): Promise<void> {
    await tx.customerVehicle.deleteMany({
      where: {
        customerId,
        vehicleId,
        role: CustomerVehicleRole.INTERESTED,
      },
    });
  }
}
