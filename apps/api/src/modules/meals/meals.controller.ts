import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MealsService } from './meals.service';

@ApiTags('Meals') @Controller('meals')
export class MealsController {
  constructor(private readonly svc: MealsService) {}
  // TODO: implement endpoints per OpenAPI spec
}
