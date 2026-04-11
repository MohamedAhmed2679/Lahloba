import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EtaService } from './eta.service';

@ApiTags('ETA') @Controller('eta')
export class EtaController {
  constructor(private readonly svc: EtaService) {}

  @Post('predict')
  @ApiOperation({ summary: 'Predict delivery ETA' })
  predict(@Body() body: { order_id: string; task_type: string; distance_km: number; stop_count: number }) {
    return this.svc.predictForOrder(body.order_id, body.task_type, body.distance_km, body.stop_count);
  }

  @Post('record/:predictionId')
  @ApiOperation({ summary: 'Record actual delivery time for training' })
  record(@Param('predictionId') id: string, @Body() body: { actual_minutes: number }) {
    return this.svc.recordActual(id, body.actual_minutes);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Model performance metrics' })
  metrics() { return this.svc.getModelMetrics(); }
}
