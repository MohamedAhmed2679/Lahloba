import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
@Injectable()
export class MealsService {
  private readonly logger = new Logger(MealsService.name);
  constructor(private db: DatabaseService) {}
  // TODO: implement business logic
}
