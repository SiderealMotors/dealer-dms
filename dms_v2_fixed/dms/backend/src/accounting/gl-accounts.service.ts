import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, NormalBalance, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGlAccountDto } from './dto/create-gl-account.dto';
import { ListGlAccountsQueryDto } from './dto/list-gl-accounts.query.dto';
import { UpdateGlAccountDto } from './dto/update-gl-account.dto';

function defaultNormalBalance(type: AccountType): NormalBalance {
  if (type === AccountType.ASSET || type === AccountType.EXPENSE) {
    return NormalBalance.DEBIT;
  }
  return NormalBalance.CREDIT;
}

@Injectable()
export class GlAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query?: ListGlAccountsQueryDto) {
    return this.prisma.glAccount.findMany({
      where: {
        ...(query?.type ? { type: query.type } : {}),
        ...(query?.includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ code: 'asc' }],
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.glAccount.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`GL account ${id} not found`);
    }
    return row;
  }

  async create(dto: CreateGlAccountDto) {
    const code = dto.code.trim();
    const hit = await this.prisma.glAccount.findUnique({ where: { code } });
    if (hit) {
      throw new ConflictException(`Account code ${code} already exists`);
    }
    if (dto.parentId) {
      await this.ensureAccount(dto.parentId);
    }
    const normalBalance = dto.normalBalance ?? defaultNormalBalance(dto.type);
    return this.prisma.glAccount.create({
      data: {
        code,
        name: dto.name.trim(),
        type: dto.type,
        normalBalance,
        description: dto.description?.trim(),
        parentId: dto.parentId,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateGlAccountDto) {
    await this.ensureAccount(id);
    if (dto.code) {
      const code = dto.code.trim();
      const clash = await this.prisma.glAccount.findFirst({
        where: { code, NOT: { id } },
      });
      if (clash) {
        throw new ConflictException(`Account code ${code} already exists`);
      }
    }
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new ConflictException('Account cannot be its own parent');
      }
      await this.ensureAccount(dto.parentId);
    }
    const data: Prisma.GlAccountUpdateInput = {};
    if (dto.code !== undefined) {
      data.code = dto.code.trim();
    }
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.type !== undefined) {
      data.type = dto.type;
    }
    if (dto.normalBalance !== undefined) {
      data.normalBalance = dto.normalBalance;
    }
    if (dto.description !== undefined) {
      data.description = dto.description?.trim() ?? null;
    }
    if (dto.parentId !== undefined) {
      data.parent = dto.parentId ? { connect: { id: dto.parentId } } : { disconnect: true };
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }
    return this.prisma.glAccount.update({ where: { id }, data });
  }

  private async ensureAccount(id: string): Promise<void> {
    const a = await this.prisma.glAccount.findUnique({ where: { id }, select: { id: true } });
    if (!a) {
      throw new NotFoundException(`GL account ${id} not found`);
    }
  }
}
