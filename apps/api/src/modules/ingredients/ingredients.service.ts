import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
@Injectable()
export class IngredientsService {
  private readonly logger = new Logger(IngredientsService.name);
  constructor(private db: DatabaseService) {}
  // TODO: implement business logic
}
