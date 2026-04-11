import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class FavoritesService {
  constructor(private db: DatabaseService) {}

  async addFavorite(userId: string, mealId: string) {
    const existing = await this.db.$queryRawUnsafe(
      `SELECT favorite_id FROM favorites WHERE user_id = $1 AND meal_id = $2`, userId, mealId
    ) as any[];
    if (existing.length > 0) throw new ConflictException('Already favorited');

    const id = `fav_${uuid().slice(0, 8)}`;
    await this.db.$executeRawUnsafe(
      `INSERT INTO favorites (favorite_id, user_id, meal_id) VALUES ($1, $2, $3)`, id, userId, mealId
    );
    return { favorite_id: id, meal_id: mealId };
  }

  async removeFavorite(userId: string, mealId: string) {
    await this.db.$executeRawUnsafe(
      `DELETE FROM favorites WHERE user_id = $1 AND meal_id = $2`, userId, mealId
    );
    return { removed: true };
  }

  async getFavorites(userId: string, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const favs = await this.db.$queryRawUnsafe(`
      SELECT f.favorite_id, f.created_at, m.meal_id, m.name_en, m.name_ar, m.type,
             m.base_price_minor, m.prep_time_min, m.rating_avg, m.image_url,
             u.name as chef_name
      FROM favorites f
      JOIN meals m ON m.meal_id = f.meal_id
      JOIN chef_profiles cp ON cp.chef_id = m.chef_id
      JOIN users u ON u.user_id = cp.chef_id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3
    `, userId, pageSize, offset);
    return { favorites: favs, page, page_size: pageSize };
  }

  async isFavorited(userId: string, mealId: string): Promise<boolean> {
    const result = await this.db.$queryRawUnsafe(
      `SELECT 1 FROM favorites WHERE user_id = $1 AND meal_id = $2`, userId, mealId
    ) as any[];
    return result.length > 0;
  }

  async getReorderSuggestions(userId: string, limit = 10) {
    const orders = await this.db.$queryRawUnsafe(`
      SELECT DISTINCT ON (o.meal_id) o.meal_id, o.chef_id, o.servings, o.pricing,
             o.created_at, m.name_en, m.name_ar, m.type, m.base_price_minor,
             m.image_url, m.rating_avg, u.name as chef_name
      FROM orders o
      JOIN meals m ON m.meal_id = o.meal_id AND m.is_active = true
      JOIN users u ON u.user_id = o.chef_id
      WHERE o.customer_id = $1 AND o.status = 'DELIVERED'
      ORDER BY o.meal_id, o.created_at DESC
      LIMIT $2
    `, userId, limit);
    return { suggestions: orders };
  }

  async reorder(userId: string, orderId: string) {
    const original = await this.db.order.findUnique({ where: { orderId } });
    if (!original || original.customerId !== userId) throw new NotFoundException('Order not found');
    return {
      meal_id: original.mealId,
      chef_id: original.chefId,
      servings: original.servings,
      ingredient_source: original.ingredientSource,
      ingredient_combo_mode: original.ingredientComboMode,
      pricing: original.pricing,
      message: 'Ready to reorder. Confirm to place new order.',
    };
  }
}
