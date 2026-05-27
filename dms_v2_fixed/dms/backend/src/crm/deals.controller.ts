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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../auth/auth.service';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { ListDealsQueryDto } from './dto/list-deals.query.dto';
import { UpdateDealDto } from './dto/update-deal.dto';

@Controller('crm/deals')
@UseGuards(JwtAuthGuard)
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get()
  list(@Query() query: ListDealsQueryDto) {
    return this.deals.findAll(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.deals.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES)
  create(@Body() dto: CreateDealDto, @CurrentUser() user: AuthContext) {
    return this.deals.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES)
  update(@Param('id') id: string, @Body() dto: UpdateDealDto, @CurrentUser() user: AuthContext) {
    return this.deals.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES)
  remove(@Param('id') id: string) {
    return this.deals.remove(id);
  }
}
