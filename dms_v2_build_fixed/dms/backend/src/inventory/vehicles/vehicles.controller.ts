import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthContext } from '../../auth/auth.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { ListVehiclesQueryDto } from './dto/list-vehicles.query.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleWithComputed, VehiclesService } from './vehicles.service';

@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES)
  create(
    @Body() dto: CreateVehicleDto,
    @CurrentUser() _user: AuthContext,
  ): Promise<VehicleWithComputed> {
    return this.vehicles.create(dto);
  }

  @Get()
  findAll(
    @Query() query: ListVehiclesQueryDto,
    @CurrentUser() _user: AuthContext,
  ): Promise<{
    items: VehicleWithComputed[];
    total: number;
    offset: number;
    limit: number;
  }> {
    return this.vehicles.findAll(query);
  }

  /** Must be registered before `GET :id` so `export` is not captured as an id. */
  @Get('export/csv')
  async exportCsv(
    @Query() query: ListVehiclesQueryDto,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const csv = await this.vehicles.exportInventoryCsv(query);
    const safeDate = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="inventory-export-${safeDate}.csv"`,
    );
    res.send(Buffer.from(csv, 'utf-8'));
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() _user: AuthContext,
  ): Promise<VehicleWithComputed> {
    return this.vehicles.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
    @CurrentUser() user: AuthContext,
  ): Promise<VehicleWithComputed> {
    return this.vehicles.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES)
  remove(
    @Param('id') id: string,
    @CurrentUser() _user: AuthContext,
  ): Promise<{ ok: true }> {
    return this.vehicles.remove(id).then(() => ({ ok: true }));
  }
}
