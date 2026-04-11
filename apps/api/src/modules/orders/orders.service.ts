import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(private db: DatabaseService) {}
  // TODO: implement business logic
}
