import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
@Injectable()
export class RatingsService {
  private readonly logger = new Logger(RatingsService.name);
  constructor(private db: DatabaseService) {}
  // TODO: implement business logic
}
