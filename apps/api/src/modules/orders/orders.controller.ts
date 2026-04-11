import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';

@ApiTags('Orders') @Controller('orders')
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}
  // TODO: implement endpoints per OpenAPI spec
}
