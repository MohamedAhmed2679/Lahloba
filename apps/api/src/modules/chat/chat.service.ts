import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  constructor(private db: DatabaseService) {}
  // TODO: implement business logic
}
