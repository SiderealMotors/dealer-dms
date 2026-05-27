import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SettingsService, UpdateDealerSettingsDto } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  getSettings() {
    return this.settings.getSettings();
  }

  @Put()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  updateSettings(@Body() dto: UpdateDealerSettingsDto) {
    return this.settings.updateSettings(dto);
  }

  @Get('users')
  getUsers() {
    return this.settings.getUsers();
  }

  @Post('users/:userId/commission')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  upsertCommission(
    @Param('userId') userId: string,
    @Body() dto: { ruleType: string; flatAmount?: number; percentOfProfit?: number; minProfit?: number; isActive?: boolean },
  ) {
    return this.settings.upsertCommissionRule(userId, dto);
  }

  @Get('commission-report')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  commissionReport(@Query('from') from: string, @Query('to') to: string) {
    return this.settings.commissionReport(from, to);
  }
}
