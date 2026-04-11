import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DeliveryService } from './delivery.service';

@ApiTags('Delivery') @Controller('delivery')
export class DeliveryController {
  constructor(private readonly svc: DeliveryService) {}
  // TODO: implement endpoints per OpenAPI spec
}
