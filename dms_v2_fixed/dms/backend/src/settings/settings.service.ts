import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export class UpdateDealerSettingsDto {
  dealerName?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  hstNumber?: string;
  omvicNumber?: string;
  hstRate?: number;
  defaultOmvicFee?: number;
  logoUrl?: string;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    let settings = await this.prisma.dealerSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.dealerSettings.create({ data: { id: 'singleton' } });
    }
    return settings;
  }

  async updateSettings(dto: UpdateDealerSettingsDto) {
    return this.prisma.dealerSettings.upsert({
      where: { id: 'singleton' },
      update: {
        ...dto,
        hstRate: dto.hstRate != null ? new Prisma.Decimal(dto.hstRate) : undefined,
        defaultOmvicFee: dto.defaultOmvicFee != null ? new Prisma.Decimal(dto.defaultOmvicFee) : undefined,
      },
      create: {
        id: 'singleton',
        ...dto,
        hstRate: dto.hstRate != null ? new Prisma.Decimal(dto.hstRate) : new Prisma.Decimal(0.13),
        defaultOmvicFee: dto.defaultOmvicFee != null ? new Prisma.Decimal(dto.defaultOmvicFee) : new Prisma.Decimal(75),
      },
    });
  }

  async getUsers() {
    return this.prisma.user.findMany({
      orderBy: { fullName: 'asc' },
      include: { commissionRule: true },
    });
  }

  async upsertCommissionRule(userId: string, dto: {
    ruleType: string;
    flatAmount?: number;
    percentOfProfit?: number;
    minProfit?: number;
    isActive?: boolean;
  }) {
    return this.prisma.commissionRule.upsert({
      where: { userId },
      update: {
        ruleType: dto.ruleType,
        flatAmount: dto.flatAmount != null ? new Prisma.Decimal(dto.flatAmount) : null,
        percentOfProfit: dto.percentOfProfit != null ? new Prisma.Decimal(dto.percentOfProfit) : null,
        minProfit: dto.minProfit != null ? new Prisma.Decimal(dto.minProfit) : null,
        isActive: dto.isActive ?? true,
      },
      create: {
        userId,
        ruleType: dto.ruleType,
        flatAmount: dto.flatAmount != null ? new Prisma.Decimal(dto.flatAmount) : null,
        percentOfProfit: dto.percentOfProfit != null ? new Prisma.Decimal(dto.percentOfProfit) : null,
        minProfit: dto.minProfit != null ? new Prisma.Decimal(dto.minProfit) : null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async commissionReport(from: string, to: string) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        deletedAt: null,
        dateSold: { gte: new Date(from), lte: new Date(to) },
        salesPersonId: { not: null },
      },
      include: {
        salesPerson: { include: { commissionRule: true } },
      },
    });

    const byPerson: Record<string, {
      userId: string;
      name: string;
      vehicles: number;
      totalRevenue: number;
      commission: number;
    }> = {};

    for (const v of vehicles) {
      if (!v.salesPerson || !v.salesPersonId) continue;
      const spId = v.salesPersonId;
      if (!byPerson[spId]) {
        byPerson[spId] = { userId: spId, name: v.salesPerson.fullName, vehicles: 0, totalRevenue: 0, commission: 0 };
      }

      const sellingPrice = Number(v.sellingPrice ?? 0);
      const purchasePrice = Number(v.purchasePrice ?? 0);
      const roughProfit = sellingPrice - purchasePrice;

      byPerson[spId].vehicles++;
      byPerson[spId].totalRevenue += sellingPrice;

      const rule = v.salesPerson.commissionRule;
      if (rule?.isActive) {
        if (rule.ruleType === 'FLAT') {
          byPerson[spId].commission += Number(rule.flatAmount ?? 0);
        } else if (rule.ruleType === 'PERCENT') {
          const minProfit = Number(rule.minProfit ?? 0);
          if (roughProfit >= minProfit) {
            byPerson[spId].commission += roughProfit * Number(rule.percentOfProfit ?? 0);
          }
        }
      }
    }

    return {
      from,
      to,
      salespeople: Object.values(byPerson).sort((a, b) => b.commission - a.commission),
    };
  }
}
