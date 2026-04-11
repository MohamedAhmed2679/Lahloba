import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EventsService } from './events.service';

@ApiTags('Events') @Controller('events')
export class EventsController {
  constructor(private readonly svc: EventsService) {}
  // TODO: implement endpoints per OpenAPI spec
}
