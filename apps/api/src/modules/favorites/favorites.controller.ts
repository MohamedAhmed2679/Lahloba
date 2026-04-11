import { Controller, Get, Post, Delete, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';

@ApiTags('Favorites') @ApiBearerAuth() @Controller('favorites')
export class FavoritesController {
  constructor(private readonly svc: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'List favorites' })
  list(@Query('page') page?: number) {
    return this.svc.getFavorites('usr_cust_001', page || 1); // TODO: extract from JWT
  }

  @Post(':mealId')
  @ApiOperation({ summary: 'Add to favorites' })
  add(@Param('mealId') mealId: string) {
    return this.svc.addFavorite('usr_cust_001', mealId);
  }

  @Delete(':mealId')
  @ApiOperation({ summary: 'Remove from favorites' })
  remove(@Param('mealId') mealId: string) {
    return this.svc.removeFavorite('usr_cust_001', mealId);
  }

  @Get('check/:mealId')
  @ApiOperation({ summary: 'Check if meal is favorited' })
  check(@Param('mealId') mealId: string) {
    return this.svc.isFavorited('usr_cust_001', mealId);
  }

  @Get('reorder-suggestions')
  @ApiOperation({ summary: 'Get reorder suggestions from past orders' })
  reorderSuggestions() {
    return this.svc.getReorderSuggestions('usr_cust_001');
  }

  @Post('reorder/:orderId')
  @ApiOperation({ summary: 'Prepare reorder from past order' })
  reorder(@Param('orderId') orderId: string) {
    return this.svc.reorder('usr_cust_001', orderId);
  }
}
