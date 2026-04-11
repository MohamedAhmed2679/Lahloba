import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuid } from 'uuid';

const TIER_THRESHOLDS = { BRONZE: 0, SILVER: 5000, GOLD: 15000, PLATINUM: 50000 };
const TIER_MULTIPLIERS = { BRONZE: 1.0, SILVER: 1.25, GOLD: 1.5, PLATINUM: 2.0 };

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(private db: DatabaseService) {}

  async getOrCreateAccount(userId: string) {
    let account = await this.db.$queryRawUnsafe(
      `SELECT * FROM loyalty_accounts WHERE user_id = $1`, userId
    ) as any[];

    if (account.length === 0) {
      const id = `la_${uuid().slice(0,8)}`;
      await this.db.$executeRawUnsafe(
        `INSERT INTO loyalty_accounts (account_id, user_id) VALUES ($1, $2)`, id, userId
      );
      account = await this.db.$queryRawUnsafe(`SELECT * FROM loyalty_accounts WHERE account_id = $1`, id) as any[];
    }
    return account[0];
  }

  async earnPoints(userId: string, action: string, points: number, refType?: string, refId?: string, description?: string) {
    const account = await this.getOrCreateAccount(userId);
    const multiplier = TIER_MULTIPLIERS[account.tier as keyof typeof TIER_MULTIPLIERS] || 1;
    const earnedPoints = Math.round(points * multiplier);
    const newBalance = account.available_points + earnedPoints;
    const newLifetime = account.lifetime_points + earnedPoints;

    await this.db.$executeRawUnsafe(
      `UPDATE loyalty_accounts SET available_points = $1, total_points = total_points + $2, lifetime_points = $3 WHERE account_id = $4`,
      newBalance, earnedPoints, newLifetime, account.account_id
    );

    // Log transaction
    const txnId = `ltx_${uuid().slice(0,8)}`;
    await this.db.$executeRawUnsafe(
      `INSERT INTO loyalty_transactions (txn_id, account_id, action, points, balance_after, reference_type, reference_id, description, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      txnId, account.account_id, action, earnedPoints, newBalance, refType, refId, description || `Earned ${earnedPoints} points`,
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year expiry
    );

    // Check tier upgrade
    await this.checkTierUpgrade(account.account_id, newLifetime);

    return { points_earned: earnedPoints, multiplier, new_balance: newBalance, lifetime: newLifetime, txn_id: txnId };
  }

  async earnFromOrder(userId: string, orderId: string, orderTotalMinor: number) {
    const pointsPerEgp = 1; // 1 point per 1 EGP
    const basePoints = Math.round(orderTotalMinor / 100 * pointsPerEgp);
    return this.earnPoints(userId, 'EARN_ORDER', basePoints, 'ORDER', orderId, `Order #${orderId}`);
  }

  private async checkTierUpgrade(accountId: string, lifetimePoints: number) {
    let newTier = 'BRONZE';
    if (lifetimePoints >= TIER_THRESHOLDS.PLATINUM) newTier = 'PLATINUM';
    else if (lifetimePoints >= TIER_THRESHOLDS.GOLD) newTier = 'GOLD';
    else if (lifetimePoints >= TIER_THRESHOLDS.SILVER) newTier = 'SILVER';

    await this.db.$executeRawUnsafe(
      `UPDATE loyalty_accounts SET tier = $1::loyalty_tier, tier_updated_at = now() WHERE account_id = $2 AND tier != $1::loyalty_tier`,
      newTier, accountId
    );
  }

  async redeemReward(userId: string, rewardId: string) {
    const account = await this.getOrCreateAccount(userId);
    const rewards = await this.db.$queryRawUnsafe(
      `SELECT * FROM loyalty_rewards WHERE reward_id = $1 AND is_active = true`, rewardId
    ) as any[];

    if (rewards.length === 0) throw new NotFoundException('Reward not found');
    const reward = rewards[0];

    if (account.available_points < reward.cost_points) throw new BadRequestException('Insufficient points');

    const newBalance = account.available_points - reward.cost_points;
    await this.db.$executeRawUnsafe(
      `UPDATE loyalty_accounts SET available_points = $1 WHERE account_id = $2`, newBalance, account.account_id
    );

    const redId = `red_${uuid().slice(0,8)}`;
    const code = `LHL${uuid().slice(0,6).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await this.db.$executeRawUnsafe(
      `INSERT INTO loyalty_redemptions (redemption_id, account_id, reward_id, points_spent, discount_minor, code, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      redId, account.account_id, rewardId, reward.cost_points, reward.reward_value, code, expiresAt.toISOString()
    );

    // Log transaction
    await this.db.$executeRawUnsafe(
      `INSERT INTO loyalty_transactions (txn_id, account_id, action, points, balance_after, reference_type, reference_id, description) VALUES ($1,$2,'REDEEM_DISCOUNT',$3,$4,'REWARD',$5,$6)`,
      `ltx_${uuid().slice(0,8)}`, account.account_id, -reward.cost_points, newBalance, rewardId, `Redeemed: ${reward.name_en}`
    );

    return { redemption_id: redId, code, reward: reward.name_en, discount_minor: reward.reward_value, expires_at: expiresAt, points_spent: reward.cost_points, new_balance: newBalance };
  }

  async getAccount(userId: string) {
    const account = await this.getOrCreateAccount(userId);
    const nextTier = account.tier === 'PLATINUM' ? null :
      account.tier === 'GOLD' ? { tier: 'PLATINUM', points_needed: TIER_THRESHOLDS.PLATINUM - account.lifetime_points } :
      account.tier === 'SILVER' ? { tier: 'GOLD', points_needed: TIER_THRESHOLDS.GOLD - account.lifetime_points } :
      { tier: 'SILVER', points_needed: TIER_THRESHOLDS.SILVER - account.lifetime_points };

    return { ...account, next_tier: nextTier };
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const account = await this.getOrCreateAccount(userId);
    const txns = await this.db.$queryRawUnsafe(
      `SELECT * FROM loyalty_transactions WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      account.account_id, limit, (page - 1) * limit
    );
    return { transactions: txns, page, limit };
  }

  async getAvailableRewards(userId: string) {
    const account = await this.getOrCreateAccount(userId);
    const rewards = await this.db.$queryRawUnsafe(
      `SELECT * FROM loyalty_rewards WHERE is_active = true AND (valid_to IS NULL OR valid_to > now()) AND min_tier <= $1::loyalty_tier ORDER BY cost_points ASC`,
      account.tier
    );
    return { rewards, available_points: account.available_points, tier: account.tier };
  }
}
