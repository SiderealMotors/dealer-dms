import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  async listForVehicle(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${vehicleId} not found`);
    }
    return this.prisma.vehicleLedgerEntry.findMany({
      where: { vehicleId },
      orderBy: { occurredOn: 'desc' },
    });
  }

  async createEntry(dto: CreateLedgerEntryDto) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${dto.vehicleId} not found`);
    }
    return this.prisma.vehicleLedgerEntry.create({
      data: {
        vehicleId: dto.vehicleId,
        category: dto.category,
        amount: dto.amount,
        description: dto.description,
        occurredOn: new Date(dto.occurredOn),
      },
    });
  }
}
