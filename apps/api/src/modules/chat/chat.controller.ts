import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';

@ApiTags('Chat') @Controller('chat')
export class ChatController {
  constructor(private readonly svc: ChatService) {}
  // TODO: implement endpoints per OpenAPI spec
}
