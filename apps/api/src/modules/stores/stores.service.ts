import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);
  constructor(private db: DatabaseService) {}
  // TODO: implement business logic
}
