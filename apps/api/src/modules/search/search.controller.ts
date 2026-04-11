import { Controller, Get, Post, Query, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('Search') @Controller('search')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Full-text search meals, chefs, ingredients' })
  search(
    @Query('q') q: string,
    @Query('type') type?: string,
    @Query('max_price') maxPrice?: number,
    @Query('locale') locale?: string,
  ) {
    return this.svc.search(q, { type, maxPrice: maxPrice ? Number(maxPrice) : undefined, locale });
  }

  @Get('popular')
  @ApiOperation({ summary: 'Popular search queries (last 7 days)' })
  popular(@Query('limit') limit?: number) {
    return this.svc.getPopularSearches(limit || 10);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Admin: Sync all meals to search index' })
  sync() {
    return this.svc.syncMeals();
  }

  @Post('log')
  @ApiOperation({ summary: 'Log search query for analytics' })
  log(@Body() body: { query: string; results_count: number; clicked_meal_id?: string }) {
    return this.svc.logQuery(null, body.query, body.results_count, body.clicked_meal_id);
  }
}
