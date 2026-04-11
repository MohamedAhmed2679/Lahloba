import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StoresService } from './stores.service';

@ApiTags('Stores') @Controller('stores')
export class StoresController {
  constructor(private readonly svc: StoresService) {}
  // TODO: implement endpoints per OpenAPI spec
}
