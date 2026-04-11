import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { MeilisearchService } from './meilisearch.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private db: DatabaseService, private meili: MeilisearchService) {}

  async syncMeals() {
    const meals = await this.db.meal.findMany({
      where: { isActive: true },
      include: { chef: { include: { user: true } }, mealIngredients: { include: { ingredient: true } } },
    });

    const docs = meals.map(m => ({
      id: m.mealId,
      name_en: m.nameEn,
      name_ar: m.nameAr,
      description_en: m.descriptionEn,
      description_ar: m.descriptionAr,
      type: m.type,
      price: Number(m.basePriceMinor) / 100,
      prep_time: m.prepTimeMin,
      allergens: m.allergens,
      rating: Number(m.ratingAvg),
      chef_name: m.chef.user.name,
      chef_id: m.chefId,
      ingredients: m.mealIngredients.map(mi => mi.ingredient.nameEn),
      ingredients_ar: m.mealIngredients.map(mi => mi.ingredient.nameAr),
    }));

    await this.meili.indexDocuments('meals', docs);
    this.logger.log(`Synced ${docs.length} meals to search`);
    return { synced: docs.length };
  }

  async search(query: string, options?: { type?: string; maxPrice?: number; allergenFree?: string[]; locale?: string }) {
    const filters: string[] = [];
    if (options?.type) filters.push(`type = "${options.type}"`);
    if (options?.maxPrice) filters.push(`price <= ${options.maxPrice}`);

    const result = await this.meili.search('meals', query, {
      filter: filters.length > 0 ? filters.join(' AND ') : undefined,
      limit: 20,
      attributesToHighlight: ['name_en', 'name_ar', 'description_en'],
    });

    return {
      meals: result.hits,
      total: result.estimatedTotalHits,
      query,
      processing_ms: result.processingTimeMs,
    };
  }

  async logQuery(userId: string | null, query: string, resultsCount: number, clickedMealId?: string) {
    // Fire-and-forget analytics
    this.db.$executeRawUnsafe(
      `INSERT INTO search_queries (query_id, user_id, query_text, results_count, clicked_meal_id, created_at) VALUES ($1, $2, $3, $4, $5, now())`,
      `sq_${uuid().slice(0, 8)}`, userId, query, resultsCount, clickedMealId
    ).catch(() => {});
  }

  async getPopularSearches(limit = 10) {
    const result = await this.db.$queryRawUnsafe(`
      SELECT query_text, COUNT(*) as count
      FROM search_queries
      WHERE created_at > now() - interval '7 days'
      GROUP BY query_text
      ORDER BY count DESC
      LIMIT $1
    `, limit);
    return result;
  }
}
