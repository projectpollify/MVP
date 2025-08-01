/**
 * Staking Statistics Service
 * Provides analytics and metrics for the staking system
 */

import { Pool } from 'pg';
import { StakingStats, PoolStats } from '../types/staking.types';

export class StakingStatsService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Get platform-wide staking statistics
   */
  async getPlatformStats(): Promise<StakingStats> {
    const client = await this.db.connect();
    
    try {
      // Get overall statistics
      const overallStatsQuery = `
        SELECT 
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_stakes,
          COALESCE(SUM(CASE WHEN status = 'active' THEN stake_amount ELSE 0 END), 0) as total_staked,
          COALESCE(SUM(reward_amount), 0) as total_rewards_earned,
          COALESCE(SUM(penalty_amount), 0) as total_penalties_burned,
          AVG(
            CASE 
              WHEN unstake_date IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (unstake_date - stake_date)) / 86400
              ELSE NULL 
            END
          ) as avg_stake_duration
        FROM user_stakes
      `;
      
      const overallResult = await client.query(overallStatsQuery);
      const overall = overallResult.rows[0];
      
      // Get pool distribution
      const poolStatsQuery = `
        SELECT 
          p.id as pool_id,
          p.pool_name,
          p.apr_rate,
          COALESCE(COUNT(CASE WHEN s.status = 'active' THEN 1 END), 0) as active_stakes,
          COALESCE(SUM(CASE WHEN s.status = 'active' THEN s.stake_amount ELSE 0 END), 0) as total_staked
        FROM staking_pools p
        LEFT JOIN user_stakes s ON p.id = s.pool_id
        WHERE p.is_active = true
        GROUP BY p.id, p.pool_name, p.apr_rate
        ORDER BY p.lock_days
      `;
      
      const poolResult = await client.query(poolStatsQuery);
      
      const poolDistribution: PoolStats[] = poolResult.rows.map(row => ({
        poolId: row.pool_id,
        poolName: row.pool_name,
        totalStaked: parseFloat(row.total_staked),
        activeStakes: parseInt(row.active_stakes),
        aprRate: parseFloat(row.apr_rate)
      }));
      
      return {
        totalStaked: parseFloat(overall.total_staked),
        totalRewardsEarned: parseFloat(overall.total_rewards_earned),
        totalPenaltiesBurned: parseFloat(overall.total_penalties_burned),
        activeStakes: parseInt(overall.active_stakes),
        averageStakeDuration: parseFloat(overall.avg_stake_duration) || 0,
        poolDistribution
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * Get staking statistics for a specific user
   */
  async getUserStats(walletAddress: string) {
    const query = `
      SELECT 
        u.wallet_pub_key,
        COUNT(CASE WHEN us.status = 'active' THEN 1 END) as active_stakes,
        COUNT(CASE WHEN us.status = 'completed' THEN 1 END) as completed_stakes,
        COUNT(CASE WHEN us.status = 'early_exit' THEN 1 END) as early_exits,
        COALESCE(SUM(CASE WHEN us.status = 'active' THEN us.stake_amount ELSE 0 END), 0) as current_staked,
        COALESCE(SUM(us.stake_amount), 0) as total_staked_all_time,
        COALESCE(SUM(us.reward_amount), 0) as total_rewards_earned,
        COALESCE(SUM(us.penalty_amount), 0) as total_penalties_paid,
        COALESCE(
          AVG(
            CASE 
              WHEN us.unstake_date IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (us.unstake_date - us.stake_date)) / 86400
              ELSE NULL 
            END
          ), 0
        ) as avg_stake_duration,
        COALESCE(
          MAX(us.stake_date), 
          NOW()
        ) as first_stake_date,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'poolId', us.pool_id,
              'poolName', p.pool_name,
              'stakeCount', (
                SELECT COUNT(*) 
                FROM user_stakes us2 
                WHERE us2.user_id = u.id 
                AND us2.pool_id = us.pool_id
              )
            )
          ) FILTER (WHERE us.pool_id IS NOT NULL), 
          '[]'::json
        ) as pool_participation
      FROM users u
      LEFT JOIN user_stakes us ON u.id = us.user_id
      LEFT JOIN staking_pools p ON us.pool_id = p.id
      WHERE u.wallet_pub_key = $1
      GROUP BY u.id, u.wallet_pub_key
    `;
    
    const result = await this.db.query(query, [walletAddress]);
    
    if (result.rows.length === 0) {
      return {
        walletAddress,
        activeStakes: 0,
        completedStakes: 0,
        earlyExits: 0,
        currentStaked: 0,
        totalStakedAllTime: 0,
        totalRewardsEarned: 0,
        totalPenaltiesPaid: 0,
        avgStakeDuration: 0,
        firstStakeDate: null,
        poolParticipation: []
      };
    }
    
    const stats = result.rows[0];
    
    return {
      walletAddress: stats.wallet_pub_key,
      activeStakes: parseInt(stats.active_stakes),
      completedStakes: parseInt(stats.completed_stakes),
      earlyExits: parseInt(stats.early_exits),
      currentStaked: parseFloat(stats.current_staked),
      totalStakedAllTime: parseFloat(stats.total_staked_all_time),
      totalRewardsEarned: parseFloat(stats.total_rewards_earned),
      totalPenaltiesPaid: parseFloat(stats.total_penalties_paid),
      avgStakeDuration: parseFloat(stats.avg_stake_duration),
      firstStakeDate: stats.first_stake_date,
      poolParticipation: stats.pool_participation
    };
  }

  /**
   * Get historical staking data for charts
   */
  async getHistoricalData(days: number = 30) {
    const query = `
      SELECT 
        date,
        total_staked,
        active_stakes_count,
        new_stakes_count,
        unstakes_count,
        total_rewards_paid
      FROM staking_statistics
      WHERE date >= CURRENT_DATE - INTERVAL '$1 days'
      ORDER BY date ASC
    `;
    
    const result = await this.db.query(query, [days]);
    
    return result.rows.map(row => ({
      date: row.date,
      totalStaked: parseFloat(row.total_staked),
      activeStakes: parseInt(row.active_stakes_count),
      newStakes: parseInt(row.new_stakes_count),
      unstakes: parseInt(row.unstakes_count),
      rewardsPaid: parseFloat(row.total_rewards_paid)
    }));
  }

  /**
   * Update daily statistics (called by cron job)
   */
  async updateDailyStats() {
    const query = `
      INSERT INTO staking_statistics (
        date,
        total_staked,
        total_rewards_paid,
        total_penalties_burned,
        active_stakes_count,
        new_stakes_count,
        unstakes_count,
        early_exits_count
      )
      SELECT 
        CURRENT_DATE,
        COALESCE(SUM(CASE WHEN status = 'active' THEN stake_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN DATE(unstake_date) = CURRENT_DATE THEN reward_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN DATE(unstake_date) = CURRENT_DATE THEN penalty_amount ELSE 0 END), 0),
        COUNT(CASE WHEN status = 'active' THEN 1 END),
        COUNT(CASE WHEN DATE(stake_date) = CURRENT_DATE THEN 1 END),
        COUNT(CASE WHEN DATE(unstake_date) = CURRENT_DATE THEN 1 END),
        COUNT(CASE WHEN DATE(unstake_date) = CURRENT_DATE AND status = 'early_exit' THEN 1 END)
      FROM user_stakes
      ON CONFLICT (date) 
      DO UPDATE SET
        total_staked = EXCLUDED.total_staked,
        total_rewards_paid = EXCLUDED.total_rewards_paid,
        total_penalties_burned = EXCLUDED.total_penalties_burned,
        active_stakes_count = EXCLUDED.active_stakes_count,
        new_stakes_count = EXCLUDED.new_stakes_count,
        unstakes_count = EXCLUDED.unstakes_count,
        early_exits_count = EXCLUDED.early_exits_count,
        created_at = NOW()
    `;
    
    await this.db.query(query);
  }

  /**
   * Get top stakers leaderboard
   */
  async getTopStakers(limit: number = 10) {
    const query = `
      SELECT 
        u.wallet_pub_key,
        u.display_name,
        SUM(CASE WHEN us.status = 'active' THEN us.stake_amount ELSE 0 END) as current_staked,
        SUM(us.reward_amount) as total_rewards,
        COUNT(CASE WHEN us.status = 'active' THEN 1 END) as active_positions
      FROM users u
      JOIN user_stakes us ON u.id = us.user_id
      GROUP BY u.id, u.wallet_pub_key, u.display_name
      HAVING SUM(CASE WHEN us.status = 'active' THEN us.stake_amount ELSE 0 END) > 0
      ORDER BY current_staked DESC
      LIMIT $1
    `;
    
    const result = await this.db.query(query, [limit]);
    
    return result.rows.map(row => ({
      walletAddress: row.wallet_pub_key,
      displayName: row.display_name,
      currentStaked: parseFloat(row.current_staked),
      totalRewards: parseFloat(row.total_rewards),
      activePositions: parseInt(row.active_positions)
    }));
  }
}
