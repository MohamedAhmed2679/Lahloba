import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(private db: DatabaseService) {}
  // TODO: implement business logic
}
