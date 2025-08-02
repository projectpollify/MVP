import { Pool } from 'pg';
import { eventEmitter } from '../../shared/events';
import { logger } from '../../shared/logger';
import { transferToken } from '../../blockchain/tokenService';
import { createBlockchainRecord } from '../../blockchain/blockchainService';

interface BadgeCompletion {
  badgeId: string;
  userId: string;
  scopeType: string;
  scopeId: string;
  actionsTaken: number;
  minActionsRequired: number;
  dutyDays: number;
  completionStatus: 'completed' | 'abandoned';
}

export class BadgeRewardsService {
  private pool: Pool;
  private readonly SYSTEM_WALLET = process.env.SYSTEM_WALLET_ADDRESS || '';

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Process expired badges and distribute rewards
   */
  async processExpiredBadges(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Find all expired active badges
      const expiredBadges = await client.query(`
        SELECT 
          mb.*,
          u.wallet_pub_key,
          mc.reward_pco,
          mc.reward_reputation,
          mc.penalty_reputation
        FROM mod_badges mb
        INNER JOIN users u ON mb.holder_id = u.id
        LEFT JOIN moderation_config mc ON mb.scope_type = mc.scope_type AND mb.scope_id = mc.scope_id
        WHERE mb.status = 'active'
        AND mb.end_date <= NOW()
        FOR UPDATE
      `);

      for (const badge of expiredBadges.rows) {
        await client.query('BEGIN');
        
        try {
          const completion: BadgeCompletion = {
            badgeId: badge.id,
            userId: badge.holder_id,
            scopeType: badge.scope_type,
            scopeId: badge.scope_id,
            actionsTaken: badge.actions_taken,
            minActionsRequired: badge.min_actions_required,
            dutyDays: badge.duty_days,
            completionStatus: badge.actions_taken >= badge.min_actions_required ? 'completed' : 'abandoned'
          };

          if (completion.completionStatus === 'completed') {
            await this.processSuccessfulCompletion(client, badge, completion);
          } else {
            await this.processAbandonedBadge(client, badge, completion);
          }

          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          logger.error(`Error processing badge ${badge.id}:`, error);
          // Continue with next badge
        }
      }
    } catch (error) {
      logger.error('Error processing expired badges:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process successful badge completion
   */
  private async processSuccessfulCompletion(
    client: any, 
    badge: any, 
    completion: BadgeCompletion
  ): Promise<void> {
    // Update badge status
    await client.query(`
      UPDATE mod_badges
      SET status = 'expired'
      WHERE id = $1
    `, [badge.id]);

    // Add to history as completed
    await client.query(`
      INSERT INTO badge_history (
        user_id, badge_id, scope_type, scope_id, completion_status
      ) VALUES ($1, $2, $3, $4, 'completed')
    `, [badge.holder_id, badge.id, badge.scope_type, badge.scope_id]);

    // Award reputation
    await client.query(`
      UPDATE users
      SET reputation_score = reputation_score + $1
      WHERE id = $2
    `, [badge.reward_reputation || 5, badge.holder_id]);

    // Transfer PCO tokens
    const pcoAmount = badge.reward_pco || 0.5;
    if (pcoAmount > 0 && badge.wallet_pub_key) {
      try {
        const tokenTransfer = await transferToken({
          from: this.SYSTEM_WALLET,
          to: badge.wallet_pub_key,
          amount: pcoAmount,
          token: 'PCO',
          memo: `Badge duty reward - ${badge.scope_type} moderator`
        });

        // Record reward distribution on blockchain
        const blockchainTx = await createBlockchainRecord({
          type: 'badge_reward_distributed',
          badgeId: badge.id,
          userId: badge.holder_id,
          pcoAmount: pcoAmount,
          reputationAmount: badge.reward_reputation || 5,
          tokenTxHash: tokenTransfer.hash,
          completionData: {
            actionsTaken: completion.actionsTaken,
            minRequired: completion.minActionsRequired,
            dutyDays: completion.dutyDays
          }
        });

        logger.info(`Distributed rewards for badge ${badge.id}: ${pcoAmount} PCO, ${badge.reward_reputation} reputation`);
      } catch (error) {
        logger.error(`Failed to transfer PCO for badge ${badge.id}:`, error);
        // Continue with process even if token transfer fails
      }
    }

    // Emit completion event
    eventEmitter.emit('badge:completed', {
      badgeId: badge.id,
      userId: badge.holder_id,
      scopeType: badge.scope_type,
      scopeId: badge.scope_id,
      actionsTaken: completion.actionsTaken,
      pcoRewarded: pcoAmount,
      reputationRewarded: badge.reward_reputation || 5
    });
  }

  /**
   * Process abandoned badge (didn't meet minimum actions)
   */
  private async processAbandonedBadge(
    client: any, 
    badge: any, 
    completion: BadgeCompletion
  ): Promise<void> {
    // Update badge status
    await client.query(`
      UPDATE mod_badges
      SET status = 'expired'
      WHERE id = $1
    `, [badge.id]);

    // Add to history as abandoned
    await client.query(`
      INSERT INTO badge_history (
        user_id, badge_id, scope_type, scope_id, completion_status
      ) VALUES ($1, $2, $3, $4, 'abandoned')
    `, [badge.holder_id, badge.id, badge.scope_type, badge.scope_id]);

    // Apply reputation penalty
    await client.query(`
      UPDATE users
      SET reputation_score = reputation_score + $1
      WHERE id = $2
    `, [badge.penalty_reputation || -3, badge.holder_id]);

    // Record on blockchain
    await createBlockchainRecord({
      type: 'badge_abandoned',
      badgeId: badge.id,
      userId: badge.holder_id,
      actionsTaken: completion.actionsTaken,
      minRequired: completion.minActionsRequired,
      reputationPenalty: badge.penalty_reputation || -3
    });

    // Emit abandonment event
    eventEmitter.emit('badge:abandoned', {
      badgeId: badge.id,
      userId: badge.holder_id,
      scopeType: badge.scope_type,
      scopeId: badge.scope_id,
      actionsTaken: completion.actionsTaken,
      minRequired: completion.minActionsRequired,
      reputationPenalty: badge.penalty_reputation || -3
    });

    logger.info(`Badge ${badge.id} abandoned - only ${completion.actionsTaken}/${completion.minActionsRequired} actions taken`);
  }

  /**
   * Calculate badge performance metrics
   */
  async calculateBadgePerformance(badgeId: string): Promise<any> {
    const result = await this.pool.query(`
      WITH badge_data AS (
        SELECT 
          mb.*,
          mc.reward_pco,
          mc.reward_reputation,
          EXTRACT(EPOCH FROM (COALESCE(mb.end_date, NOW()) - mb.start_date)) / 3600 as hours_active
        FROM mod_badges mb
        LEFT JOIN moderation_config mc ON mb.scope_type = mc.scope_type AND mb.scope_id = mc.scope_id
        WHERE mb.id = $1
      ),
      action_stats AS (
        SELECT 
          COUNT(*) as total_actions,
          COUNT(CASE WHEN action = 'keep' THEN 1 END) as keeps,
          COUNT(CASE WHEN action = 'remove' THEN 1 END) as removes,
          AVG(EXTRACT(EPOCH FROM (ma.created_at - bd.start_date)) / 3600) as avg_hours_to_action
        FROM mod_actions ma
        CROSS JOIN badge_data bd
        WHERE ma.badge_id = $1
      )
      SELECT 
        bd.*,
        as.total_actions,
        as.keeps,
        as.removes,
        as.avg_hours_to_action,
        CASE 
          WHEN bd.hours_active > 0 THEN as.total_actions / (bd.hours_active / 24)
          ELSE 0
        END as actions_per_day,
        CASE 
          WHEN bd.actions_taken >= bd.min_actions_required THEN 'completed'
          WHEN bd.status = 'active' THEN 'in_progress'
          ELSE 'abandoned'
        END as performance_status
      FROM badge_data bd
      CROSS JOIN action_stats as
    `, [badgeId]);

    return result.rows[0];
  }

  /**
   * Get leaderboard of top moderators
   */
  async getModeratorLeaderboard(
    scopeType?: 'group' | 'pillar', 
    scopeId?: string, 
    timeframe: 'week' | 'month' | 'all' = 'month'
  ): Promise<any[]> {
    let timeConstraint = '';
    if (timeframe === 'week') {
      timeConstraint = "AND bh.completed_at > NOW() - INTERVAL '7 days'";
    } else if (timeframe === 'month') {
      timeConstraint = "AND bh.completed_at > NOW() - INTERVAL '30 days'";
    }

    let scopeConstraint = '';
    const params: any[] = [];
    if (scopeType && scopeId) {
      scopeConstraint = 'AND bh.scope_type = $1 AND bh.scope_id = $2';
      params.push(scopeType, scopeId);
    }

    const query = `
      WITH moderator_stats AS (
        SELECT 
          u.id,
          u.display_name,
          u.wallet_pub_key,
          COUNT(DISTINCT bh.badge_id) as badges_completed,
          SUM(mb.actions_taken) as total_actions,
          AVG(mb.actions_taken) as avg_actions_per_badge,
          SUM(CASE WHEN mb.actions_taken >= mb.min_actions_required THEN 1 ELSE 0 END) as successful_completions,
          MAX(bh.completed_at) as last_badge_completed
        FROM users u
        INNER JOIN badge_history bh ON u.id = bh.user_id
        INNER JOIN mod_badges mb ON bh.badge_id = mb.id
        WHERE bh.completion_status = 'completed'
        ${timeConstraint}
        ${scopeConstraint}
        GROUP BY u.id, u.display_name, u.wallet_pub_key
      )
      SELECT 
        *,
        RANK() OVER (ORDER BY badges_completed DESC, total_actions DESC) as rank
      FROM moderator_stats
      ORDER BY rank
      LIMIT 20
    `;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Check if a user qualifies for bonus rewards
   */
  async checkBonusEligibility(userId: string): Promise<{
    eligible: boolean;
    milestones: any[];
  }> {
    // Check various milestones
    const stats = await this.pool.query(`
      SELECT 
        COUNT(DISTINCT bh.badge_id) as total_badges,
        COUNT(DISTINCT CASE 
          WHEN bh.completion_status = 'completed' THEN bh.badge_id 
        END) as completed_badges,
        SUM(mb.actions_taken) as total_actions,
        COUNT(DISTINCT mb.scope_id) as unique_scopes,
        COUNT(DISTINCT CASE 
          WHEN mb.scope_type = 'pillar' THEN mb.scope_id 
        END) as pillar_badges
      FROM badge_history bh
      INNER JOIN mod_badges mb ON bh.badge_id = mb.id
      WHERE bh.user_id = $1
    `, [userId]);

    const userStats = stats.rows[0];
    const milestones = [];

    // Define milestones
    if (userStats.completed_badges >= 10) {
      milestones.push({
        type: 'veteran_moderator',
        description: '10 badges completed',
        reward: { pco: 5, reputation: 20 }
      });
    }

    if (userStats.total_actions >= 100) {
      milestones.push({
        type: 'centurion',
        description: '100 moderation actions',
        reward: { pco: 3, reputation: 15 }
      });
    }

    if (userStats.pillar_badges >= 1) {
      milestones.push({
        type: 'pillar_guardian',
        description: 'Completed a pillar-level badge',
        reward: { pco: 2, reputation: 10 }
      });
    }

    return {
      eligible: milestones.length > 0,
      milestones
    };
  }
}
