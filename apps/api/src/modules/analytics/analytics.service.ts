import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  constructor(private db: DatabaseService) {}

  async getChefAnalytics(chefId: string, from: string, to: string) {
    const daily = await this.db.$queryRawUnsafe(`
      SELECT date, orders_received, orders_completed, orders_cancelled, revenue_minor, avg_prep_time_min, avg_rating, top_meal_id, peak_hour
      FROM analytics_daily_chef WHERE chef_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date`, chefId, from, to) as any[];

    const summary = {
      total_orders: daily.reduce((s: number, d: any) => s + (d.orders_received || 0), 0),
      completed: daily.reduce((s: number, d: any) => s + (d.orders_completed || 0), 0),
      cancelled: daily.reduce((s: number, d: any) => s + (d.orders_cancelled || 0), 0),
      total_revenue_minor: daily.reduce((s: number, d: any) => s + (Number(d.revenue_minor) || 0), 0),
      avg_rating: daily.length > 0 ? daily.reduce((s: number, d: any) => s + (Number(d.avg_rating) || 0), 0) / daily.filter((d: any) => d.avg_rating).length : null,
      avg_prep_time: daily.length > 0 ? Math.round(daily.reduce((s: number, d: any) => s + (d.avg_prep_time_min || 0), 0) / daily.length) : null,
    };

    // Peak hours distribution
    const hourCounts: Record<number, number> = {};
    daily.forEach((d: any) => { if (d.peak_hour != null) hourCounts[d.peak_hour] = (hourCounts[d.peak_hour] || 0) + 1; });

    // Top meals
    const topMeals = await this.db.$queryRawUnsafe(`
      SELECT m.meal_id, m.name_en, m.name_ar, COUNT(o.order_id) as order_count, SUM((o.pricing->>'total'->>'amount_minor')::bigint) as revenue
      FROM orders o JOIN meals m ON m.meal_id = o.meal_id
      WHERE o.chef_id = $1 AND o.status = 'DELIVERED' AND o.created_at BETWEEN $2 AND $3
      GROUP BY m.meal_id, m.name_en, m.name_ar ORDER BY order_count DESC LIMIT 5`, chefId, from, to);

    return { chef_id: chefId, period: { from, to }, summary, daily, peak_hours: hourCounts, top_meals: topMeals };
  }

  async getStoreAnalytics(storeId: string, from: string, to: string) {
    const daily = await this.db.$queryRawUnsafe(`
      SELECT date, baskets_received, baskets_completed, substitutions_proposed, substitutions_approved, revenue_minor, avg_pack_time_min, out_of_stock_count, peak_hour
      FROM analytics_daily_store WHERE store_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date`, storeId, from, to) as any[];

    const summary = {
      total_baskets: daily.reduce((s: number, d: any) => s + (d.baskets_received || 0), 0),
      completed: daily.reduce((s: number, d: any) => s + (d.baskets_completed || 0), 0),
      substitution_rate: daily.length > 0 ? (daily.reduce((s: number, d: any) => s + (d.substitutions_proposed || 0), 0) / Math.max(1, daily.reduce((s: number, d: any) => s + (d.baskets_received || 0), 0)) * 100).toFixed(1) + '%' : '0%',
      total_revenue_minor: daily.reduce((s: number, d: any) => s + (Number(d.revenue_minor) || 0), 0),
      avg_pack_time: daily.length > 0 ? Math.round(daily.reduce((s: number, d: any) => s + (d.avg_pack_time_min || 0), 0) / daily.length) : null,
      total_out_of_stock: daily.reduce((s: number, d: any) => s + (d.out_of_stock_count || 0), 0),
    };

    return { store_id: storeId, period: { from, to }, summary, daily };
  }

  async getZoneAnalytics(zoneId: string, date: string) {
    const hourly = await this.db.$queryRawUnsafe(`
      SELECT hour, orders_count, gmv_minor, avg_delivery_min, cancellation_count
      FROM analytics_hourly_orders WHERE zone_id = $1 AND date = $2 ORDER BY hour`, zoneId, date) as any[];

    return {
      zone_id: zoneId, date,
      hourly,
      totals: {
        orders: hourly.reduce((s: number, h: any) => s + (h.orders_count || 0), 0),
        gmv_minor: hourly.reduce((s: number, h: any) => s + (Number(h.gmv_minor) || 0), 0),
        cancellations: hourly.reduce((s: number, h: any) => s + (h.cancellation_count || 0), 0),
      },
    };
  }

  // Daily aggregation job — run via cron
  async aggregateDaily(date: string) {
    this.logger.log(`Running daily aggregation for ${date}`);
    // Chef analytics
    await this.db.$executeRawUnsafe(`
      INSERT INTO analytics_daily_chef (id, chef_id, date, orders_received, orders_completed, orders_cancelled, revenue_minor, avg_rating)
      SELECT gen_random_uuid()::text, o.chef_id, $1::date,
        COUNT(*), COUNT(*) FILTER (WHERE o.status = 'DELIVERED'), COUNT(*) FILTER (WHERE o.status = 'CANCELLED'),
        COALESCE(SUM((o.pricing->>'total'->>'amount_minor')::bigint) FILTER (WHERE o.status = 'DELIVERED'), 0),
        AVG(r.chef_score)
      FROM orders o LEFT JOIN ratings r ON r.order_id = o.order_id
      WHERE o.created_at::date = $1::date
      GROUP BY o.chef_id
      ON CONFLICT (chef_id, date) DO UPDATE SET orders_received = EXCLUDED.orders_received, orders_completed = EXCLUDED.orders_completed, revenue_minor = EXCLUDED.revenue_minor
    `, date);

    return { aggregated: date };
  }
}
