import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';

@ApiTags('Ratings') @Controller('ratings')
export class RatingsController {
  constructor(private readonly svc: RatingsService) {}
  // TODO: implement endpoints per OpenAPI spec
}
