import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';

@ApiTags('Payments') @Controller('payments')
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}
  // TODO: implement endpoints per OpenAPI spec
}
