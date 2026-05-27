import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JournalStatus, Prisma } from '@prisma/client';
import { resolveListPagination } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertJournalBalanced,
  decimalToDecimalString,
  sumJournalLines,
  toDecimal,
} from './accounting.utils';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { JournalLineInputDto } from './dto/journal-line-input.dto';
import { ListJournalEntriesQueryDto } from './dto/list-journal-entries.query.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';

type NormalizedLine = {
  accountId: string;
  debitAmount: Prisma.Decimal;
  creditAmount: Prisma.Decimal;
  memo?: string | null;
};

@Injectable()
export class JournalEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListJournalEntriesQueryDto) {
    const where: Prisma.JournalEntryWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.from || query.to) {
      where.entryDate = {};
      if (query.from) {
        where.entryDate.gte = new Date(query.from);
      }
      if (query.to) {
        where.entryDate.lte = new Date(query.to);
      }
    }
    const { take, skip } = resolveListPagination(query);
    const rows = await this.prisma.journalEntry.findMany({
      where,
      orderBy: [{ entryDate: 'desc' }, { entryNum: 'desc' }],
      skip,
      take,
      include: {
        lines: {
          orderBy: { lineNumber: 'asc' },
          include: { account: { select: { id: true, code: true, name: true } } },
        },
      },
    });
    return rows.map((r) => this.serializeEntry(r));
  }

  async findOne(id: string) {
    const row = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          orderBy: { lineNumber: 'asc' },
          include: { account: { select: { id: true, code: true, name: true, type: true } } },
        },
        vehicle: { select: { id: true, vin: true, make: true, model: true, year: true } },
      },
    });
    if (!row) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }
    return this.serializeEntry(row);
  }

  async create(dto: CreateJournalEntryDto) {
    if (dto.vehicleId) {
      await this.ensureVehicle(dto.vehicleId);
    }
    const normalized = this.normalizeLines(dto.lines);
    assertJournalBalanced(normalized);
    await this.ensureAccountsActive(normalized.map((l) => l.accountId));

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          entryDate: new Date(dto.entryDate),
          description: dto.description.trim(),
          memo: dto.memo?.trim() ?? null,
          vehicleId: dto.vehicleId ?? null,
          status: JournalStatus.DRAFT,
          lines: {
            create: normalized.map((l, i) => ({
              lineNumber: i + 1,
              accountId: l.accountId,
              debitAmount: l.debitAmount,
              creditAmount: l.creditAmount,
              memo: l.memo?.trim() ?? null,
            })),
          },
        },
        include: {
          lines: {
            orderBy: { lineNumber: 'asc' },
            include: { account: { select: { id: true, code: true, name: true } } },
          },
          vehicle: { select: { id: true, vin: true, year: true, make: true, model: true } },
        },
      });
      return this.serializeEntry(entry);
    });
  }

  async update(id: string, dto: UpdateJournalEntryDto) {
    const existing = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!existing) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }
    if (existing.status !== JournalStatus.DRAFT) {
      throw new ConflictException('Only draft journal entries can be edited');
    }
    if (dto.vehicleId) {
      await this.ensureVehicle(dto.vehicleId);
    }

    let normalized: NormalizedLine[] | null = null;
    if (dto.lines) {
      normalized = this.normalizeLines(dto.lines);
      assertJournalBalanced(normalized);
      await this.ensureAccountsActive(normalized.map((l) => l.accountId));
    }

    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.JournalEntryUpdateInput = {};
      if (dto.entryDate !== undefined) {
        data.entryDate = new Date(dto.entryDate);
      }
      if (dto.description !== undefined) {
        data.description = dto.description.trim();
      }
      if (dto.memo !== undefined) {
        data.memo = dto.memo?.trim() ?? null;
      }
      if (dto.vehicleId !== undefined) {
        data.vehicleId = dto.vehicleId;
      }
      if (normalized) {
        data.lines = {
          deleteMany: {},
          create: normalized.map((l, i) => ({
            lineNumber: i + 1,
            accountId: l.accountId,
            debitAmount: l.debitAmount,
            creditAmount: l.creditAmount,
            memo: l.memo?.trim() ?? null,
          })),
        };
      }

      const entry = await tx.journalEntry.update({
        where: { id },
        data,
        include: {
          lines: {
            orderBy: { lineNumber: 'asc' },
            include: { account: { select: { id: true, code: true, name: true } } },
          },
          vehicle: { select: { id: true, vin: true, year: true, make: true, model: true } },
        },
      });
      return this.serializeEntry(entry);
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.journalEntry.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }
    if (existing.status !== JournalStatus.DRAFT) {
      throw new ConflictException('Only draft journal entries can be deleted');
    }
    await this.prisma.journalEntry.delete({ where: { id } });
  }

  async post(id: string) {
    const existing = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!existing) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }
    if (existing.status === JournalStatus.POSTED) {
      throw new ConflictException('Journal entry is already posted');
    }
    assertJournalBalanced(existing.lines);
    await this.ensureAccountsActive(existing.lines.map((l) => l.accountId));

    const entry = await this.prisma.journalEntry.update({
      where: { id },
      data: {
        status: JournalStatus.POSTED,
        postedAt: new Date(),
      },
      include: {
        lines: {
          orderBy: { lineNumber: 'asc' },
          include: { account: { select: { id: true, code: true, name: true } } },
        },
        vehicle: { select: { id: true, vin: true, year: true, make: true, model: true } },
      },
    });
    return this.serializeEntry(entry);
  }

  private normalizeLines(lines: JournalLineInputDto[]): NormalizedLine[] {
    const out: NormalizedLine[] = [];
    for (const l of lines) {
      const dr = l.debitAmount ?? 0;
      const cr = l.creditAmount ?? 0;
      if (dr > 0 && cr > 0) {
        throw new BadRequestException('Each line must have either a debit or a credit, not both');
      }
      if (dr <= 0 && cr <= 0) {
        throw new BadRequestException('Each line must have a positive debit or credit amount');
      }
      out.push({
        accountId: l.accountId,
        debitAmount: dr > 0 ? toDecimal(dr) : toDecimal(0),
        creditAmount: cr > 0 ? toDecimal(cr) : toDecimal(0),
        memo: l.memo?.trim() ?? null,
      });
    }
    return out;
  }

  private async ensureAccountsActive(accountIds: string[]): Promise<void> {
    const unique = [...new Set(accountIds)];
    const accounts = await this.prisma.glAccount.findMany({
      where: { id: { in: unique } },
      select: { id: true, code: true, isActive: true },
    });
    if (accounts.length !== unique.length) {
      throw new BadRequestException('One or more GL accounts were not found');
    }
    const inactive = accounts.filter((a) => !a.isActive);
    if (inactive.length > 0) {
      throw new BadRequestException(
        `Inactive accounts cannot be used: ${inactive.map((a) => a.code).join(', ')}`,
      );
    }
  }

  private async ensureVehicle(vehicleId: string): Promise<void> {
    const v = await this.prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } });
    if (!v) {
      throw new NotFoundException(`Vehicle ${vehicleId} not found`);
    }
  }

  private serializeEntry(row: {
    id: string;
    entryNum: number;
    entryDate: Date;
    description: string;
    memo: string | null;
    status: JournalStatus;
    postedAt: Date | null;
    vehicleId: string | null;
    createdAt: Date;
    updatedAt: Date;
    lines: {
      id: string;
      lineNumber: number;
      accountId: string;
      debitAmount: Prisma.Decimal;
      creditAmount: Prisma.Decimal;
      memo: string | null;
      account: { id: string; code: string; name: string };
    }[];
    vehicle?: { id: string; vin: string; year: number; make: string; model: string } | null;
  }) {
    const { debits, credits } = sumJournalLines(row.lines);
    return {
      id: row.id,
      entryNum: row.entryNum,
      entryDate: row.entryDate.toISOString().slice(0, 10),
      description: row.description,
      memo: row.memo,
      status: row.status,
      postedAt: row.postedAt ? row.postedAt.toISOString() : null,
      vehicleId: row.vehicleId,
      vehicle: row.vehicle ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      totals: {
        debits: decimalToDecimalString(debits)!,
        credits: decimalToDecimalString(credits)!,
      },
      lines: row.lines.map((l) => ({
        id: l.id,
        lineNumber: l.lineNumber,
        accountId: l.accountId,
        account: l.account,
        debitAmount: decimalToDecimalString(l.debitAmount)!,
        creditAmount: decimalToDecimalString(l.creditAmount)!,
        memo: l.memo,
      })),
    };
  }
}
