import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  constructor(private db: DatabaseService) {}
  // TODO: implement business logic
}
