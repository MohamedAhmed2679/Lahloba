import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('Users') @Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}
  // TODO: implement endpoints per OpenAPI spec
}
