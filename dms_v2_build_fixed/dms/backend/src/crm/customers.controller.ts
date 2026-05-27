import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateCustomerNoteDto } from './dto/create-customer-note.dto';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { LinkCustomerVehicleDto } from './dto/link-customer-vehicle.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

/** Sub-routes registered before `:id` to avoid any ambiguity with literal segments. */
@Controller('crm/customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list() {
    return this.customers.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES)
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Get(':id/notes')
  listNotes(@Param('id') id: string) {
    return this.customers.listNotes(id);
  }

  @Post(':id/notes')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES)
  addNote(@Param('id') id: string, @Body() dto: CreateCustomerNoteDto) {
    return this.customers.addNote(id, dto);
  }

  @Delete(':id/notes/:noteId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES)
  deleteNote(@Param('id') id: string, @Param('noteId') noteId: string) {
    return this.customers.deleteNote(id, noteId);
  }

  @Get(':id/interactions')
  listInteractions(@Param('id') id: string) {
    return this.customers.listInteractions(id);
  }

  @Post(':id/interactions')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES)
  addInteraction(@Param('id') id: string, @Body() dto: CreateInteractionDto) {
    return this.customers.addInteraction(id, dto);
  }

  @Get(':id/vehicles')
  listVehicles(@Param('id') id: string) {
    return this.customers.listVehicleLinks(id);
  }

  @Post(':id/vehicles')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES)
  linkVehicle(@Param('id') id: string, @Body() dto: LinkCustomerVehicleDto) {
    return this.customers.linkVehicle(id, dto);
  }

  @Delete(':id/vehicles/:vehicleId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES)
  unlinkVehicle(@Param('id') id: string, @Param('vehicleId') vehicleId: string) {
    return this.customers.unlinkVehicle(id, vehicleId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES)
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES)
  remove(@Param('id') id: string) {
    return this.customers.remove(id);
  }
}
