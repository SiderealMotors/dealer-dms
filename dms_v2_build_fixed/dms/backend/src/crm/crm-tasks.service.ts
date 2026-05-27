import { Injectable, NotFoundException } from '@nestjs/common';
import { CrmTaskStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCrmTaskDto } from './dto/create-task.dto';
import { ListCrmTasksQueryDto } from './dto/list-tasks.query.dto';
import { UpdateCrmTaskDto } from './dto/update-task.dto';

@Injectable()
export class CrmTasksService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListCrmTasksQueryDto) {
    const where: Prisma.CrmTaskWhereInput = {};
    if (query.customerId) {
      where.customerId = query.customerId;
    }
    if (query.dealId) {
      where.dealId = query.dealId;
    }
    if (query.status) {
      where.status = query.status;
    }
    return this.prisma.crmTask.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      include: {
        customer: { select: { id: true, fullName: true, email: true, phone: true } },
        deal: { select: { id: true, title: true, stage: true } },
      },
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.crmTask.findUnique({
      where: { id },
      include: {
        customer: true,
        deal: true,
      },
    });
    if (!row) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    return row;
  }

  async create(dto: CreateCrmTaskDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) {
      throw new NotFoundException(`Customer ${dto.customerId} not found`);
    }
    if (dto.dealId) {
      const deal = await this.prisma.deal.findFirst({
        where: { id: dto.dealId, customerId: dto.customerId },
      });
      if (!deal) {
        throw new NotFoundException('Deal not found for this customer');
      }
    }
    return this.prisma.crmTask.create({
      data: {
        customerId: dto.customerId,
        dealId: dto.dealId,
        title: dto.title,
        description: dto.description,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        status: dto.status ?? CrmTaskStatus.OPEN,
      },
      include: {
        customer: { select: { id: true, fullName: true } },
        deal: { select: { id: true, title: true } },
      },
    });
  }

  async update(id: string, dto: UpdateCrmTaskDto) {
    await this.ensureTask(id);
    const data: Prisma.CrmTaskUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = dto.title;
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    if (dto.dueAt !== undefined) {
      data.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === CrmTaskStatus.DONE && dto.completedAt === undefined) {
        data.completedAt = new Date();
      }
    }
    if (dto.completedAt !== undefined) {
      data.completedAt = dto.completedAt ? new Date(dto.completedAt) : null;
    }
    return this.prisma.crmTask.update({
      where: { id },
      data,
      include: {
        customer: { select: { id: true, fullName: true } },
        deal: { select: { id: true, title: true } },
      },
    });
  }

  async remove(id: string) {
    await this.ensureTask(id);
    await this.prisma.crmTask.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async ensureTask(id: string): Promise<void> {
    const t = await this.prisma.crmTask.findUnique({ where: { id }, select: { id: true } });
    if (!t) {
      throw new NotFoundException(`Task ${id} not found`);
    }
  }
}
