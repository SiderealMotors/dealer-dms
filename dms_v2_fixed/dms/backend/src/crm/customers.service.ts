import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerVehicleRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateCustomerNoteDto } from './dto/create-customer-note.dto';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { LinkCustomerVehicleDto } from './dto/link-customer-vehicle.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.customer.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { deals: true, tasks: true, vehicleLinks: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        vehicleLinks: { include: { vehicle: { select: { id: true, vin: true, year: true, make: true, model: true } } } },
        deals: { take: 20, orderBy: { updatedAt: 'desc' } },
        _count: { select: { notes: true, interactions: true, tasks: true } },
      },
    });
    if (!row) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return row;
  }

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: dto });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.ensureCustomer(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureCustomer(id);
    await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async listNotes(customerId: string) {
    await this.ensureCustomer(customerId);
    return this.prisma.customerNote.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addNote(customerId: string, dto: CreateCustomerNoteDto) {
    await this.ensureCustomer(customerId);
    return this.prisma.customerNote.create({
      data: { customerId, body: dto.body },
    });
  }

  async deleteNote(customerId: string, noteId: string) {
    await this.ensureCustomer(customerId);
    const note = await this.prisma.customerNote.findFirst({
      where: { id: noteId, customerId },
    });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    await this.prisma.customerNote.delete({ where: { id: noteId } });
  }

  async listInteractions(customerId: string) {
    await this.ensureCustomer(customerId);
    return this.prisma.interactionLog.findMany({
      where: { customerId },
      orderBy: { occurredAt: 'desc' },
    });
  }

  async addInteraction(customerId: string, dto: CreateInteractionDto) {
    await this.ensureCustomer(customerId);
    return this.prisma.interactionLog.create({
      data: {
        customerId,
        channel: dto.channel,
        summary: dto.summary,
        detail: dto.detail,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      },
    });
  }

  async listVehicleLinks(customerId: string) {
    await this.ensureCustomer(customerId);
    return this.prisma.customerVehicle.findMany({
      where: { customerId },
      include: {
        vehicle: {
          select: {
            id: true,
            vin: true,
            year: true,
            make: true,
            model: true,
            trim: true,
            status: true,
            dateSold: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async linkVehicle(customerId: string, dto: LinkCustomerVehicleDto) {
    await this.ensureCustomer(customerId);
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${dto.vehicleId} not found`);
    }
    try {
      return await this.prisma.customerVehicle.create({
        data: {
          customerId,
          vehicleId: dto.vehicleId,
          role: dto.role ?? CustomerVehicleRole.INTERESTED,
        },
        include: {
          vehicle: {
            select: { id: true, vin: true, year: true, make: true, model: true },
          },
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Vehicle already linked to this customer');
      }
      throw e;
    }
  }

  async unlinkVehicle(customerId: string, vehicleId: string) {
    await this.ensureCustomer(customerId);
    const link = await this.prisma.customerVehicle.findUnique({
      where: { customerId_vehicleId: { customerId, vehicleId } },
    });
    if (!link) {
      throw new NotFoundException('Link not found');
    }
    await this.prisma.customerVehicle.delete({
      where: { customerId_vehicleId: { customerId, vehicleId } },
    });
  }

  private async ensureCustomer(id: string): Promise<void> {
    const c = await this.prisma.customer.findUnique({ where: { id }, select: { id: true } });
    if (!c) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
  }
}
