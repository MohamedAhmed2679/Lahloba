import { Controller, Get, Post, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics') @ApiBearerAuth() @Controller('analytics')
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @Get('chef/:chefId')
  @ApiOperation({ summary: 'Chef analytics dashboard data' })
  chef(@Param('chefId') id: string, @Query('from') from: string, @Query('to') to: string) { return this.svc.getChefAnalytics(id, from, to); }

  @Get('store/:storeId')
  @ApiOperation({ summary: 'Store analytics dashboard data' })
  store(@Param('storeId') id: string, @Query('from') from: string, @Query('to') to: string) { return this.svc.getStoreAnalytics(id, from, to); }

  @Get('zone/:zoneId')
  @ApiOperation({ summary: 'Zone hourly analytics' })
  zone(@Param('zoneId') id: string, @Query('date') date: string) { return this.svc.getZoneAnalytics(id, date); }

  @Post('aggregate')
  @ApiOperation({ summary: 'Run daily aggregation (admin/cron)' })
  aggregate(@Query('date') date: string) { return this.svc.aggregateDaily(date); }
}
