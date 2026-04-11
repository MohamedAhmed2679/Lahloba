import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);
  constructor(private db: DatabaseService) {}
  // TODO: implement business logic
}
