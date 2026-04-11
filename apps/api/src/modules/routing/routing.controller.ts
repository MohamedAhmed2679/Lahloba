import { Controller, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RoutingService } from './routing.service';

@ApiTags('Routing') @Controller('routing')
export class RoutingController {
  constructor(private readonly svc: RoutingService) {}

  @Post('optimize/:taskId')
  @ApiOperation({ summary: 'Optimize route for a delivery task' })
  optimize(@Param('taskId') taskId: string) { return this.svc.optimizeRoute(taskId); }

  @Post('batch-optimize')
  @ApiOperation({ summary: 'Batch optimize all available tasks in a zone' })
  batch(@Body() body: { zone_id: string }) { return this.svc.batchOptimize(body.zone_id); }
}
