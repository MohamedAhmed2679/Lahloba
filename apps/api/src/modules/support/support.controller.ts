import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SupportService } from './support.service';

@ApiTags('Support') @Controller('support')
export class SupportController {
  constructor(private readonly svc: SupportService) {}
  // TODO: implement endpoints per OpenAPI spec
}
