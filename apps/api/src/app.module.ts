import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MealsModule } from './modules/meals/meals.module';
import { OrdersModule } from './modules/orders/orders.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { ChatModule } from './modules/chat/chat.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { SupportModule } from './modules/support/support.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { EventsModule } from './modules/events/events.module';
import { DatabaseModule } from './database/database.module';
// v1.1 Improvements
import { SearchModule } from './modules/search/search.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { EtaModule } from './modules/eta/eta.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { RoutingModule } from './modules/routing/routing.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({ imports: [
  ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
  ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
  DatabaseModule,
  // Core
  AuthModule, UsersModule, MealsModule, OrdersModule, DeliveryModule,
  ChatModule, PaymentsModule, RatingsModule, SupportModule,
  NotificationsModule, PayoutsModule, EventsModule,
  // v1.1 Improvements
  SearchModule, FavoritesModule, AvailabilityModule,
  EtaModule, LoyaltyModule, RoutingModule, AnalyticsModule,
] })
export class AppModule {}
