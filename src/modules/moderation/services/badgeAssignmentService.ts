import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { eventEmitter } from '../../shared/events';
import { logger } from '../../shared/logger';

interface BadgeAssignmentConfig {
  scopeType: 'group' | 'pillar';
  scopeId: string;
  badgeRatio: number;
  minReputation: number;
  minAccountAgeDays: number;
}

interface EligibleUser {
  id: string;
  wallet_pub_key: string;
  display_name: string;
  reputation_score: number;
  account_age_days: number;
  last_active: Date;
}

export class BadgeAssignmentService {
  private pool: Pool;
  private readonly DEFAULT_BADGE_RATIO = 50;
  private readonly MIN_DUTY_DAYS = 3;
  private readonly MAX_DUTY_DAYS = 7;
  private readonly INVITATION_TIMEOUT_HOURS = 12;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Main method to check and assign badges for a scope
   */
  async checkAndAssignBadges(scopeType: 'group' | 'pillar', scopeId: string): Promise<void> {
    try {
      // Get configuration for this scope
      const config = await this.getOrCreateConfig(scopeType, scopeId);
      
      // Calculate how many badges are needed
      const activeMemberCount = await this.getActiveMemberCount(scopeType, scopeId);
      const desiredBadges = Math.ceil(activeMemberCount / config.badgeRatio);
      const currentBadges = await this.getActiveBadgeCount(scopeType, scopeId);
      const badgesNeeded = Math.max(0, desiredBadges - currentBadges);

      logger.info(`Badge check for ${scopeType} ${scopeId}: ${activeMemberCount} active members, ${desiredBadges} desired, ${currentBadges} current, ${badgesNeeded} needed`);

      // Assign new badges if needed
      for (let i = 0; i < badgesNeeded; i++) {
        await this.assignNewBadge(scopeType, scopeId, config);
      }
    } catch (error) {
      logger.error('Error in badge assignment check:', error);
      throw error;
    }
  }

  /**
   * Assign a new badge to an eligible user
   */
  private async assignNewBadge(
    scopeType: 'group' | 'pillar', 
    scopeId: string, 
    config: BadgeAssignmentConfig
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get eligible users
      const eligibleUsers = await this.getEligibleUsers(scopeType, scopeId, config);
      
      if (eligibleUsers.length === 0) {
        logger.warn(`No eligible users found for ${scopeType} ${scopeId}`);
        await client.query('ROLLBACK');
        return;
      }

      // Random selection
      const selectedUser = eligibleUsers[Math.floor(Math.random() * eligibleUsers.length)];
      
      // Random duty period (3-7 days)
      const dutyDays = Math.floor(Math.random() * (this.MAX_DUTY_DAYS - this.MIN_DUTY_DAYS + 1)) + this.MIN_DUTY_DAYS;
      
      // Create badge offer
      const badgeId = uuidv4();
      const badge = await client.query(`
        INSERT INTO mod_badges (
          id, scope_type, scope_id, holder_id, status, duty_days
        ) VALUES ($1, $2, $3, $4, 'offered', $5)
        RETURNING *
      `, [badgeId, scopeType, scopeId, selectedUser.id, dutyDays]);

      // Create invitation
      await client.query(`
        INSERT INTO badge_invitations (
          badge_id, user_id, expires_at
        ) VALUES ($1, $2, NOW() + INTERVAL '${this.INVITATION_TIMEOUT_HOURS} hours')
      `, [badgeId, selectedUser.id]);

      await client.query('COMMIT');

      // Emit event for notification system
      eventEmitter.emit('badge:offered', {
        badgeId,
        userId: selectedUser.id,
        scopeType,
        scopeId,
        dutyDays,
        expiresAt: new Date(Date.now() + this.INVITATION_TIMEOUT_HOURS * 60 * 60 * 1000)
      });

      logger.info(`Badge offered to user ${selectedUser.id} for ${dutyDays} days`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get eligible users for badge assignment
   */
  private async getEligibleUsers(
    scopeType: 'group' | 'pillar', 
    scopeId: string,
    config: BadgeAssignmentConfig
  ): Promise<EligibleUser[]> {
    // Build the appropriate join based on scope type
    const scopeJoin = scopeType === 'group' 
      ? 'INNER JOIN group_members gm ON u.id = gm.user_id AND gm.group_id = $1'
      : 'INNER JOIN users u2 ON u.id = u2.id AND u2.pillar_id = $1::INTEGER';

    const result = await this.pool.query(`
      SELECT DISTINCT
        u.id,
        u.wallet_pub_key,
        u.display_name,
        COALESCE(u.reputation_score, 0) as reputation_score,
        EXTRACT(DAY FROM NOW() - u.created_at) as account_age_days,
        GREATEST(
          u.last_login,
          COALESCE(MAX(p.created_at), '1970-01-01'::timestamp)
        ) as last_active
      FROM users u
      ${scopeJoin}
      LEFT JOIN posts p ON u.id = p.user_id
      WHERE 
        -- Basic eligibility
        u.mode = true -- Not in Soul mode
        AND COALESCE(u.reputation_score, 0) >= $2
        AND EXTRACT(DAY FROM NOW() - u.created_at) >= $3
        -- Not currently a badge holder
        AND NOT EXISTS (
          SELECT 1 FROM mod_badges mb 
          WHERE mb.holder_id = u.id 
          AND mb.status IN ('offered', 'active')
        )
        -- Not in previous cycle
        AND NOT EXISTS (
          SELECT 1 FROM badge_history bh
          WHERE bh.user_id = u.id
          AND bh.scope_type = $4
          AND bh.scope_id = $5
          AND bh.completed_at > NOW() - INTERVAL '14 days'
        )
        -- Active in last 30 days
        AND (
          u.last_login > NOW() - INTERVAL '30 days'
          OR EXISTS (
            SELECT 1 FROM posts p2 
            WHERE p2.user_id = u.id 
            AND p2.created_at > NOW() - INTERVAL '30 days'
          )
        )
      GROUP BY u.id, u.wallet_pub_key, u.display_name, u.reputation_score, u.created_at, u.last_login
      ORDER BY RANDOM()
    `, [scopeId, config.minReputation, config.minAccountAgeDays, scopeType, scopeId]);

    return result.rows;
  }

  /**
   * Get count of active members in a scope
   */
  private async getActiveMemberCount(scopeType: 'group' | 'pillar', scopeId: string): Promise<number> {
    let query: string;
    let params: any[];

    if (scopeType === 'group') {
      query = `
        SELECT COUNT(DISTINCT u.id) as count
        FROM users u
        INNER JOIN group_members gm ON u.id = gm.user_id
        WHERE gm.group_id = $1
        AND u.mode = true
        AND (
          u.last_login > NOW() - INTERVAL '30 days'
          OR EXISTS (
            SELECT 1 FROM posts p 
            WHERE p.user_id = u.id 
            AND p.created_at > NOW() - INTERVAL '30 days'
          )
        )
      `;
      params = [scopeId];
    } else {
      query = `
        SELECT COUNT(*) as count
        FROM users u
        WHERE u.pillar_id = $1::INTEGER
        AND u.mode = true
        AND (
          u.last_login > NOW() - INTERVAL '30 days'
          OR EXISTS (
            SELECT 1 FROM posts p 
            WHERE p.user_id = u.id 
            AND p.created_at > NOW() - INTERVAL '30 days'
          )
        )
      `;
      params = [scopeId];
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count);
  }

  /**
   * Get count of active badges in a scope
   */
  private async getActiveBadgeCount(scopeType: 'group' | 'pillar', scopeId: string): Promise<number> {
    const result = await this.pool.query(`
      SELECT COUNT(*) as count
      FROM mod_badges
      WHERE scope_type = $1
      AND scope_id = $2
      AND status IN ('offered', 'active')
    `, [scopeType, scopeId]);
    
    return parseInt(result.rows[0].count);
  }

  /**
   * Get or create moderation config for a scope
   */
  private async getOrCreateConfig(scopeType: 'group' | 'pillar', scopeId: string): Promise<BadgeAssignmentConfig> {
    // Try to get existing config
    let result = await this.pool.query(`
      SELECT * FROM moderation_config
      WHERE scope_type = $1 AND scope_id = $2
    `, [scopeType, scopeId]);

    // Create default config if none exists
    if (result.rows.length === 0) {
      result = await this.pool.query(`
        INSERT INTO moderation_config (scope_type, scope_id)
        VALUES ($1, $2)
        RETURNING *
      `, [scopeType, scopeId]);
    }

    const config = result.rows[0];
    return {
      scopeType: config.scope_type,
      scopeId: config.scope_id,
      badgeRatio: config.badge_ratio,
      minReputation: config.min_reputation,
      minAccountAgeDays: config.min_account_age_days
    };
  }

  /**
   * Process invitation timeouts
   */
  async processInvitationTimeouts(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Find expired invitations
      const expiredInvitations = await client.query(`
        SELECT bi.*, mb.scope_type, mb.scope_id, mb.duty_days
        FROM badge_invitations bi
        INNER JOIN mod_badges mb ON bi.badge_id = mb.id
        WHERE bi.response IS NULL
        AND bi.expires_at < NOW()
        AND mb.status = 'offered'
      `);

      for (const invitation of expiredInvitations.rows) {
        // Update invitation as timed out
        await client.query(`
          UPDATE badge_invitations
          SET response = 'timeout', responded_at = NOW()
          WHERE id = $1
        `, [invitation.id]);

        // Update badge status
        await client.query(`
          UPDATE mod_badges
          SET status = 'declined'
          WHERE id = $1
        `, [invitation.badge_id]);

        // Emit timeout event
        eventEmitter.emit('badge:timeout', {
          badgeId: invitation.badge_id,
          userId: invitation.user_id
        });

        // Immediately try to assign to another user
        await this.assignNewBadge(
          invitation.scope_type, 
          invitation.scope_id,
          await this.getOrCreateConfig(invitation.scope_type, invitation.scope_id)
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error processing invitation timeouts:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}
