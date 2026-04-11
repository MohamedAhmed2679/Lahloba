import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuid } from 'uuid';

interface SlotInput { day_of_week: number; start_time: string; end_time: string; max_orders: number; }
interface OverrideInput { date: string; is_available: boolean; start_time?: string; end_time?: string; max_orders?: number; reason?: string; }

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(private db: DatabaseService) {}

  async getWeeklySchedule(chefId: string) {
    const slots = await this.db.$queryRawUnsafe(
      `SELECT * FROM chef_availability_slots WHERE chef_id = $1 AND is_active = true ORDER BY day_of_week, start_time`, chefId
    );
    return { chef_id: chefId, slots };
  }

  async setWeeklySlots(chefId: string, slots: SlotInput[]) {
    // Clear existing and insert new
    await this.db.$executeRawUnsafe(`DELETE FROM chef_availability_slots WHERE chef_id = $1`, chefId);
    for (const s of slots) {
      if (s.day_of_week < 0 || s.day_of_week > 6) throw new BadRequestException('Invalid day_of_week');
      await this.db.$executeRawUnsafe(
        `INSERT INTO chef_availability_slots (slot_id, chef_id, day_of_week, start_time, end_time, max_orders) VALUES ($1,$2,$3,$4,$5,$6)`,
        `slot_${uuid().slice(0,8)}`, chefId, s.day_of_week, s.start_time, s.end_time, s.max_orders
      );
    }
    return this.getWeeklySchedule(chefId);
  }

  async addOverride(chefId: string, input: OverrideInput) {
    const id = `ovr_${uuid().slice(0,8)}`;
    await this.db.$executeRawUnsafe(
      `INSERT INTO chef_availability_overrides (override_id, chef_id, date, is_available, start_time, end_time, max_orders, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (chef_id, date) DO UPDATE SET is_available=$4, start_time=$5, end_time=$6, max_orders=$7, reason=$8`,
      id, chefId, input.date, input.is_available, input.start_time, input.end_time, input.max_orders, input.reason
    );
    return { override_id: id, ...input };
  }

  async getAvailability(chefId: string, fromDate: string, toDate: string) {
    const slots = await this.db.$queryRawUnsafe(
      `SELECT * FROM chef_availability_slots WHERE chef_id = $1 AND is_active = true`, chefId
    ) as any[];
    const overrides = await this.db.$queryRawUnsafe(
      `SELECT * FROM chef_availability_overrides WHERE chef_id = $1 AND date BETWEEN $2 AND $3`, chefId, fromDate, toDate
    ) as any[];
    const blocks = await this.db.$queryRawUnsafe(
      `SELECT * FROM chef_blocked_dates WHERE chef_id = $1 AND start_date <= $3 AND end_date >= $2`, chefId, fromDate, toDate
    ) as any[];

    // Build daily availability for the range
    const days: any[] = [];
    const start = new Date(fromDate);
    const end = new Date(toDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dow = d.getDay();
      const override = overrides.find((o: any) => o.date === dateStr);
      const blocked = blocks.some((b: any) => dateStr >= b.start_date && dateStr <= b.end_date);
      const regularSlots = slots.filter((s: any) => s.day_of_week === dow);

      days.push({
        date: dateStr,
        day_of_week: dow,
        is_available: blocked ? false : override ? override.is_available : regularSlots.length > 0,
        slots: override ? [{ start: override.start_time, end: override.end_time, max: override.max_orders }]
          : regularSlots.map((s: any) => ({ start: s.start_time, end: s.end_time, max: s.max_orders })),
        is_override: !!override,
        is_blocked: blocked,
        block_reason: blocked ? blocks.find((b: any) => dateStr >= b.start_date && dateStr <= b.end_date)?.reason : null,
      });
    }
    return { chef_id: chefId, from: fromDate, to: toDate, days };
  }

  async blockDates(chefId: string, startDate: string, endDate: string, reason?: string) {
    const id = `blk_${uuid().slice(0,8)}`;
    await this.db.$executeRawUnsafe(
      `INSERT INTO chef_blocked_dates (block_id, chef_id, start_date, end_date, reason) VALUES ($1,$2,$3,$4,$5)`,
      id, chefId, startDate, endDate, reason
    );
    return { block_id: id, start_date: startDate, end_date: endDate };
  }
}
