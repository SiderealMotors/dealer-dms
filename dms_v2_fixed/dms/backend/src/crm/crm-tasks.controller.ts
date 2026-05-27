import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CrmTasksService } from './crm-tasks.service';
import { CreateCrmTaskDto } from './dto/create-task.dto';
import { ListCrmTasksQueryDto } from './dto/list-tasks.query.dto';
import { UpdateCrmTaskDto } from './dto/update-task.dto';

@Controller('crm/tasks')
@UseGuards(JwtAuthGuard)
export class CrmTasksController {
  constructor(private readonly tasks: CrmTasksService) {}

  @Get()
  list(@Query() query: ListCrmTasksQueryDto) {
    return this.tasks.findAll(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.tasks.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES)
  create(@Body() dto: CreateCrmTaskDto) {
    return this.tasks.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES)
  update(@Param('id') id: string, @Body() dto: UpdateCrmTaskDto) {
    return this.tasks.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES)
  remove(@Param('id') id: string) {
    return this.tasks.remove(id);
  }
}
