import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IngredientsService } from './ingredients.service';

@ApiTags('Ingredients') @Controller('ingredients')
export class IngredientsController {
  constructor(private readonly svc: IngredientsService) {}
  // TODO: implement endpoints per OpenAPI spec
}
