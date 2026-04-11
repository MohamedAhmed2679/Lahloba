import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';

@ApiTags('Availability') @ApiBearerAuth() @Controller('availability')
export class AvailabilityController {
  constructor(private readonly svc: AvailabilityService) {}

  @Get(':chefId/schedule')
  @ApiOperation({ summary: 'Get weekly schedule' })
  schedule(@Param('chefId') chefId: string) { return this.svc.getWeeklySchedule(chefId); }

  @Put(':chefId/schedule')
  @ApiOperation({ summary: 'Set weekly slots' })
  setSchedule(@Param('chefId') chefId: string, @Body() body: { slots: any[] }) { return this.svc.setWeeklySlots(chefId, body.slots); }

  @Get(':chefId')
  @ApiOperation({ summary: 'Get availability for date range' })
  availability(@Param('chefId') chefId: string, @Query('from') from: string, @Query('to') to: string) { return this.svc.getAvailability(chefId, from, to); }

  @Post(':chefId/override')
  @ApiOperation({ summary: 'Add date override' })
  override(@Param('chefId') chefId: string, @Body() body: any) { return this.svc.addOverride(chefId, body); }

  @Post(':chefId/block')
  @ApiOperation({ summary: 'Block date range' })
  block(@Param('chefId') chefId: string, @Body() body: { start_date: string; end_date: string; reason?: string }) { return this.svc.blockDates(chefId, body.start_date, body.end_date, body.reason); }
}
