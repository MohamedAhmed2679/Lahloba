import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LoyaltyService } from './loyalty.service';

@ApiTags('Loyalty') @ApiBearerAuth() @Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly svc: LoyaltyService) {}

  @Get('account')
  @ApiOperation({ summary: 'Get loyalty account with tier info' })
  account() { return this.svc.getAccount('usr_cust_001'); }

  @Get('transactions')
  @ApiOperation({ summary: 'List points transactions' })
  transactions(@Query('page') page?: number) { return this.svc.getTransactions('usr_cust_001', page || 1); }

  @Get('rewards')
  @ApiOperation({ summary: 'Available rewards to redeem' })
  rewards() { return this.svc.getAvailableRewards('usr_cust_001'); }

  @Post('redeem/:rewardId')
  @ApiOperation({ summary: 'Redeem a reward' })
  redeem(@Param('rewardId') rewardId: string) { return this.svc.redeemReward('usr_cust_001', rewardId); }

  @Post('earn/order')
  @ApiOperation({ summary: 'Earn points from completed order' })
  earnFromOrder(@Body() body: { order_id: string; total_minor: number }) {
    return this.svc.earnFromOrder('usr_cust_001', body.order_id, body.total_minor);
  }
}
