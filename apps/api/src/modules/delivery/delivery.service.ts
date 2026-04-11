import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);
  constructor(private db: DatabaseService) {}
  // TODO: implement business logic
}
