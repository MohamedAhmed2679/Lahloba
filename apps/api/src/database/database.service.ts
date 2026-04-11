import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL || 'postgresql://lahloba:lahloba_secret@localhost:5432/lahloba',
    });
    super({ adapter });
  }
  private readonly logger = new Logger(DatabaseService.name);
  async onModuleInit() { await this.$connect(); this.logger.log('DB connected'); }
  async onModuleDestroy() { await this.$disconnect(); }
}
