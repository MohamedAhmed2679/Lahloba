import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications') @Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}
  // TODO: implement endpoints per OpenAPI spec
}
