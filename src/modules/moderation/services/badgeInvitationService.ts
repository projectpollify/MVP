import { Pool } from 'pg';
import { eventEmitter } from '../../shared/events';
import { logger } from '../../shared/logger';
import { createBlockchainRecord } from '../../blockchain/blockchainService';

interface BadgeInvitation {
  id: string;
  badge_id: string;
  user_id: string;
  scope_type: string;
  scope_id: string;
  duty_days: number;
  expires_at: Date;
  status: string;
}

export class BadgeInvitationService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get pending invitations for a user
   */
  async getUserInvitations(userId: string): Promise<BadgeInvitation[]> {
    const result = await this.pool.query(`
      SELECT 
        bi.*,
        mb.scope_type,
        mb.scope_id,
        mb.duty_days,
        mb.status,
        CASE 
          WHEN mb.scope_type = 'group' THEN g.name
          ELSE p.name
        END as scope_name
      FROM badge_invitations bi
      INNER JOIN mod_badges mb ON bi.badge_id = mb.id
      LEFT JOIN groups g ON mb.scope_type = 'group' AND mb.scope_id = g.id
      LEFT JOIN pillars p ON mb.scope_type = 'pillar' AND mb.scope_id::INTEGER = p.id
      WHERE bi.user_id = $1
      AND bi.response IS NULL
      AND bi.expires_at > NOW()
      AND mb.status = 'offered'
      ORDER BY bi.invited_at DESC
    `, [userId]);

    return result.rows;
  }

  /**
   * Accept a badge invitation
   */
  async acceptInvitation(userId: string, badgeId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verify the invitation exists and is valid
      const invitation = await client.query(`
        SELECT bi.*, mb.scope_type, mb.scope_id, mb.duty_days
        FROM badge_invitations bi
        INNER JOIN mod_badges mb ON bi.badge_id = mb.id
        WHERE bi.badge_id = $1
        AND bi.user_id = $2
        AND bi.response IS NULL
        AND bi.expires_at > NOW()
        AND mb.status = 'offered'
        FOR UPDATE
      `, [badgeId, userId]);

      if (invitation.rows.length === 0) {
        throw new Error('Invalid or expired invitation');
      }

      const badgeData = invitation.rows[0];

      // Update invitation
      await client.query(`
        UPDATE badge_invitations
        SET response = 'accepted', responded_at = NOW()
        WHERE id = $1
      `, [badgeData.id]);

      // Calculate end date
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + badgeData.duty_days);

      // Activate the badge
      await client.query(`
        UPDATE mod_badges
        SET 
          status = 'active',
          accepted_at = NOW(),
          start_date = NOW(),
          end_date = $1
        WHERE id = $2
      `, [endDate, badgeId]);

      // Record acceptance on blockchain
      const blockchainTx = await createBlockchainRecord({
        type: 'badge_accepted',
        badgeId: badgeId,
        userId: userId,
        scopeType: badgeData.scope_type,
        scopeId: badgeData.scope_id,
        dutyDays: badgeData.duty_days,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // Update badge with blockchain hash
      await client.query(`
        UPDATE mod_badges
        SET blockchain_tx_hash = $1
        WHERE id = $2
      `, [blockchainTx.hash, badgeId]);

      await client.query('COMMIT');

      // Emit event
      eventEmitter.emit('badge:accepted', {
        badgeId,
        userId,
        scopeType: badgeData.scope_type,
        scopeId: badgeData.scope_id,
        dutyDays: badgeData.duty_days,
        endDate
      });

      logger.info(`User ${userId} accepted badge ${badgeId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error accepting badge invitation:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Decline a badge invitation
   */
  async declineInvitation(userId: string, badgeId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verify the invitation
      const invitation = await client.query(`
        SELECT bi.*, mb.scope_type, mb.scope_id
        FROM badge_invitations bi
        INNER JOIN mod_badges mb ON bi.badge_id = mb.id
        WHERE bi.badge_id = $1
        AND bi.user_id = $2
        AND bi.response IS NULL
        AND mb.status = 'offered'
        FOR UPDATE
      `, [badgeId, userId]);

      if (invitation.rows.length === 0) {
        throw new Error('Invalid invitation');
      }

      const badgeData = invitation.rows[0];

      // Update invitation
      await client.query(`
        UPDATE badge_invitations
        SET response = 'declined', responded_at = NOW()
        WHERE id = $1
      `, [badgeData.id]);

      // Update badge status
      await client.query(`
        UPDATE mod_badges
        SET status = 'declined'
        WHERE id = $1
      `, [badgeId]);

      await client.query('COMMIT');

      // Emit event
      eventEmitter.emit('badge:declined', {
        badgeId,
        userId,
        scopeType: badgeData.scope_type,
        scopeId: badgeData.scope_id
      });

      // Trigger immediate reassignment
      const { BadgeAssignmentService } = require('./badgeAssignmentService');
      const assignmentService = new BadgeAssignmentService(this.pool);
      await assignmentService.checkAndAssignBadges(badgeData.scope_type, badgeData.scope_id);

      logger.info(`User ${userId} declined badge ${badgeId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error declining badge invitation:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get current active badge for a user
   */
  async getUserActiveBadge(userId: string): Promise<any> {
    const result = await this.pool.query(`
      SELECT 
        mb.*,
        CASE 
          WHEN mb.scope_type = 'group' THEN g.name
          ELSE p.name
        END as scope_name,
        (mb.end_date - NOW()) as time_remaining,
        ROUND((mb.actions_taken::NUMERIC / NULLIF(mb.min_actions_required, 0)) * 100) as progress_percentage
      FROM mod_badges mb
      LEFT JOIN groups g ON mb.scope_type = 'group' AND mb.scope_id = g.id
      LEFT JOIN pillars p ON mb.scope_type = 'pillar' AND mb.scope_id::INTEGER = p.id
      WHERE mb.holder_id = $1
      AND mb.status = 'active'
      LIMIT 1
    `, [userId]);

    return result.rows[0] || null;
  }

  /**
   * Check if user is eligible for badges
   */
  async checkUserEligibility(userId: string): Promise<{
    eligible: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    
    // Get user data
    const userResult = await this.pool.query(`
      SELECT 
        *,
        EXTRACT(DAY FROM NOW() - created_at) as account_age_days
      FROM users
      WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return { eligible: false, reasons: ['User not found'] };
    }

    const user = userResult.rows[0];

    // Check basic eligibility
    if (!user.mode) {
      reasons.push('Account is in Soul mode');
    }

    if (user.reputation_score < 0) {
      reasons.push('Reputation score is below 0');
    }

    if (user.account_age_days < 7) {
      reasons.push('Account is less than 7 days old');
    }

    // Check if currently holding a badge
    const activeBadge = await this.pool.query(`
      SELECT id FROM mod_badges
      WHERE holder_id = $1
      AND status IN ('offered', 'active')
      LIMIT 1
    `, [userId]);

    if (activeBadge.rows.length > 0) {
      reasons.push('Currently holding or offered a badge');
    }

    // Check recent history
    const recentHistory = await this.pool.query(`
      SELECT COUNT(*) as count
      FROM badge_history
      WHERE user_id = $1
      AND completed_at > NOW() - INTERVAL '14 days'
    `, [userId]);

    if (parseInt(recentHistory.rows[0].count) > 0) {
      reasons.push('Held a badge in the last 14 days');
    }

    return {
      eligible: reasons.length === 0,
      reasons
    };
  }

  /**
   * Pass badge to next eligible user (emergency option)
   */
  async passBadge(userId: string, badgeId: string, reason: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verify user holds this active badge
      const badge = await client.query(`
        SELECT * FROM mod_badges
        WHERE id = $1
        AND holder_id = $2
        AND status = 'active'
        FOR UPDATE
      `, [badgeId, userId]);

      if (badge.rows.length === 0) {
        throw new Error('Badge not found or not active');
      }

      const badgeData = badge.rows[0];

      // Record the pass action
      await client.query(`
        INSERT INTO mod_actions (
          badge_id, content_type, content_id, action, reason
        ) VALUES ($1, 'badge', $2, 'passed', $3)
      `, [badgeId, badgeId, reason]);

      // Mark badge as abandoned
      await client.query(`
        UPDATE mod_badges
        SET status = 'abandoned', end_date = NOW()
        WHERE id = $1
      `, [badgeId]);

      // Add to history
      await client.query(`
        INSERT INTO badge_history (
          user_id, badge_id, scope_type, scope_id, completion_status
        ) VALUES ($1, $2, $3, $4, 'abandoned')
      `, [userId, badgeId, badgeData.scope_type, badgeData.scope_id]);

      // Apply reputation penalty
      await client.query(`
        UPDATE users
        SET reputation_score = reputation_score - 3
        WHERE id = $1
      `, [userId]);

      await client.query('COMMIT');

      // Emit event
      eventEmitter.emit('badge:passed', {
        badgeId,
        userId,
        reason,
        scopeType: badgeData.scope_type,
        scopeId: badgeData.scope_id
      });

      // Trigger immediate reassignment
      const { BadgeAssignmentService } = require('./badgeAssignmentService');
      const assignmentService = new BadgeAssignmentService(this.pool);
      await assignmentService.checkAndAssignBadges(badgeData.scope_type, badgeData.scope_id);

      logger.info(`User ${userId} passed badge ${badgeId} with reason: ${reason}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error passing badge:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}
