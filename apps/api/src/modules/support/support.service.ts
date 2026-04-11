import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);
  constructor(private db: DatabaseService) {}
  // TODO: implement business logic
}
