import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

class PublicLeadDto {
  fullName: string;
  phone?: string;
  email?: string;
  vehicleId?: string;
  message?: string;
}

@Controller('public')
export class PublicController {
  constructor(private readonly prisma: PrismaService) {}

  /** Public inventory listing — no auth required. Safe fields only. */
  @Get('inventory')
  async publicInventory(
    @Query('make') make?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('minYear') minYear?: string,
    @Query('limit') limit?: string,
  ) {
    const where: any = { deletedAt: null, status: 'AVAILABLE' };
    if (make) where.make = { contains: make, mode: 'insensitive' };
    if (maxPrice) where.sellingPrice = { lte: Number(maxPrice) };
    if (minYear) where.year = { gte: Number(minYear) };

    const vehicles = await this.prisma.vehicle.findMany({
      where,
      select: {
        id: true,
        year: true,
        make: true,
        model: true,
        trim: true,
        colour: true,
        odometer: true,
        sellingPrice: true,
        status: true,
        photos: { select: { url: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit ?? 50), 100),
    });

    return { vehicles: vehicles.map(v => ({
      ...v,
      sellingPrice: v.sellingPrice ? Number(v.sellingPrice) : null,
      primaryPhoto: v.photos[0]?.url ?? null,
    })) };
  }

  /** Public lead submission from website contact/enquiry forms. */
  @Post('leads')
  async submitLead(@Body() dto: PublicLeadDto) {
    // Find or create customer
    let customer = await this.prisma.customer.findFirst({
      where: {
        deletedAt: null,
        OR: [
          dto.email ? { email: dto.email } : undefined,
          { fullName: dto.fullName },
        ].filter(Boolean) as any[],
      },
    });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          fullName: dto.fullName,
          phone: dto.phone,
          email: dto.email,
        },
      });
    }

    const lead = await this.prisma.lead.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        source: 'WEB',
        status: 'NEW_LEAD',
        summary: dto.message ?? 'Website enquiry',
        customerId: customer.id,
        vehicleId: dto.vehicleId ?? null,
      },
    });

    return { success: true, leadId: lead.id };
  }
}
