import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PayoutsService } from './payouts.service';

@ApiTags('Payouts') @Controller('payouts')
export class PayoutsController {
  constructor(private readonly svc: PayoutsService) {}
  // TODO: implement endpoints per OpenAPI spec
}
