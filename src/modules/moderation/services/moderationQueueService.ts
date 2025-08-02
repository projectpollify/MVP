import { Pool } from 'pg';
import { eventEmitter } from '../../shared/events';
import { logger } from '../../shared/logger';
import { createBlockchainRecord } from '../../blockchain/blockchainService';

interface FlaggedContent {
  id: string;
  content_type: 'post' | 'comment';
  content_id: string;
  content_text: string;
  author_id: string;
  author_name: string;
  created_at: Date;
  flag_count: number;
  flag_reasons: string[];
  group_id?: string;
  group_name?: string;
  already_hidden: boolean;
  previous_actions: any[];
}

interface ModerationDecision {
  badgeId: string;
  contentType: 'post' | 'comment';
  contentId: string;
  action: 'keep' | 'remove';
  reason?: string;
}

export class ModerationQueueService {
  private pool: Pool;
  private readonly AUTO_HIDE_THRESHOLD = 5;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get moderation queue for a badge holder
   */
  async getModerationQueue(userId: string, badgeId: string): Promise<FlaggedContent[]> {
    // First verify the user holds this active badge
    const badgeCheck = await this.pool.query(`
      SELECT mb.*, mc.min_reputation
      FROM mod_badges mb
      LEFT JOIN moderation_config mc ON mb.scope_type = mc.scope_type AND mb.scope_id = mc.scope_id
      WHERE mb.id = $1
      AND mb.holder_id = $2
      AND mb.status = 'active'
    `, [badgeId, userId]);

    if (badgeCheck.rows.length === 0) {
      throw new Error('Invalid badge or not active');
    }

    const badge = badgeCheck.rows[0];

    // Get flagged content based on scope
    let query: string;
    let params: any[];

    if (badge.scope_type === 'group') {
      // For group badges, get flags from that group
      query = `
        WITH flagged_items AS (
          SELECT 
            cf.content_type,
            cf.content_id,
            COUNT(*) as flag_count,
            array_agg(DISTINCT cf.reason) as flag_reasons,
            MAX(cf.created_at) as last_flagged
          FROM content_flags cf
          WHERE cf.group_id = $1
          AND cf.resolved = false
          GROUP BY cf.content_type, cf.content_id
        ),
        previous_actions AS (
          SELECT 
            ma.content_type,
            ma.content_id,
            json_agg(json_build_object(
              'action', ma.action,
              'reason', ma.reason,
              'created_at', ma.created_at
            ) ORDER BY ma.created_at DESC) as actions
          FROM mod_actions ma
          WHERE ma.badge_id != $2
          GROUP BY ma.content_type, ma.content_id
        )
        SELECT 
          fi.content_type,
          fi.content_id,
          fi.flag_count,
          fi.flag_reasons,
          CASE 
            WHEN fi.content_type = 'post' THEN p.content
            ELSE c.content
          END as content_text,
          CASE 
            WHEN fi.content_type = 'post' THEN p.user_id
            ELSE c.user_id
          END as author_id,
          CASE 
            WHEN fi.content_type = 'post' THEN u1.display_name
            ELSE u2.display_name
          END as author_name,
          CASE 
            WHEN fi.content_type = 'post' THEN p.created_at
            ELSE c.created_at
          END as created_at,
          CASE 
            WHEN fi.content_type = 'post' THEN p.is_hidden
            ELSE c.is_hidden
          END as already_hidden,
          g.id as group_id,
          g.name as group_name,
          COALESCE(pa.actions, '[]'::json) as previous_actions
        FROM flagged_items fi
        LEFT JOIN posts p ON fi.content_type = 'post' AND fi.content_id = p.id
        LEFT JOIN comments c ON fi.content_type = 'comment' AND fi.content_id = c.id
        LEFT JOIN users u1 ON p.user_id = u1.id
        LEFT JOIN users u2 ON c.user_id = u2.id
        LEFT JOIN groups g ON g.id = $1
        LEFT JOIN previous_actions pa ON pa.content_type = fi.content_type AND pa.content_id = fi.content_id
        WHERE 
          -- Content exists
          (fi.content_type = 'post' AND p.id IS NOT NULL)
          OR (fi.content_type = 'comment' AND c.id IS NOT NULL)
        ORDER BY 
          fi.flag_count DESC,
          fi.last_flagged ASC
      `;
      params = [badge.scope_id, badgeId];
    } else {
      // For pillar badges, get flags from all groups in that pillar
      query = `
        WITH flagged_items AS (
          SELECT 
            cf.content_type,
            cf.content_id,
            cf.group_id,
            COUNT(*) as flag_count,
            array_agg(DISTINCT cf.reason) as flag_reasons,
            MAX(cf.created_at) as last_flagged
          FROM content_flags cf
          INNER JOIN groups g ON cf.group_id = g.id
          WHERE g.pillar_id = $1::INTEGER
          AND cf.resolved = false
          GROUP BY cf.content_type, cf.content_id, cf.group_id
        ),
        previous_actions AS (
          SELECT 
            ma.content_type,
            ma.content_id,
            json_agg(json_build_object(
              'action', ma.action,
              'reason', ma.reason,
              'created_at', ma.created_at
            ) ORDER BY ma.created_at DESC) as actions
          FROM mod_actions ma
          WHERE ma.badge_id != $2
          GROUP BY ma.content_type, ma.content_id
        )
        SELECT 
          fi.content_type,
          fi.content_id,
          fi.flag_count,
          fi.flag_reasons,
          CASE 
            WHEN fi.content_type = 'post' THEN p.content
            ELSE c.content
          END as content_text,
          CASE 
            WHEN fi.content_type = 'post' THEN p.user_id
            ELSE c.user_id
          END as author_id,
          CASE 
            WHEN fi.content_type = 'post' THEN u1.display_name
            ELSE u2.display_name
          END as author_name,
          CASE 
            WHEN fi.content_type = 'post' THEN p.created_at
            ELSE c.created_at
          END as created_at,
          CASE 
            WHEN fi.content_type = 'post' THEN p.is_hidden
            ELSE c.is_hidden
          END as already_hidden,
          g.id as group_id,
          g.name as group_name,
          COALESCE(pa.actions, '[]'::json) as previous_actions
        FROM flagged_items fi
        LEFT JOIN posts p ON fi.content_type = 'post' AND fi.content_id = p.id
        LEFT JOIN comments c ON fi.content_type = 'comment' AND fi.content_id = c.id
        LEFT JOIN users u1 ON p.user_id = u1.id
        LEFT JOIN users u2 ON c.user_id = u2.id
        LEFT JOIN groups g ON g.id = fi.group_id
        LEFT JOIN previous_actions pa ON pa.content_type = fi.content_type AND pa.content_id = fi.content_id
        WHERE 
          -- Content exists
          (fi.content_type = 'post' AND p.id IS NOT NULL)
          OR (fi.content_type = 'comment' AND c.id IS NOT NULL)
        ORDER BY 
          fi.flag_count DESC,
          fi.last_flagged ASC
      `;
      params = [badge.scope_id, badgeId];
    }

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Submit a moderation decision
   */
  async submitModerationDecision(userId: string, decision: ModerationDecision): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verify badge ownership and get details
      const badge = await this.pool.query(`
        SELECT * FROM mod_badges
        WHERE id = $1
        AND holder_id = $2
        AND status = 'active'
        FOR UPDATE
      `, [decision.badgeId, userId]);

      if (badge.rows.length === 0) {
        throw new Error('Invalid badge or not active');
      }

      const badgeData = badge.rows[0];

      // Get current flag count
      const flagCount = await client.query(`
        SELECT COUNT(*) as count
        FROM content_flags
        WHERE content_type = $1
        AND content_id = $2
        AND resolved = false
      `, [decision.contentType, decision.contentId]);

      // Record the moderation action
      const actionResult = await client.query(`
        INSERT INTO mod_actions (
          badge_id, content_type, content_id, action, reason, flags_at_review
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        decision.badgeId,
        decision.contentType,
        decision.contentId,
        decision.action,
        decision.reason || null,
        flagCount.rows[0].count
      ]);

      // Handle the decision
      if (decision.action === 'remove') {
        // Hide the content
        if (decision.contentType === 'post') {
          await client.query(`
            UPDATE posts
            SET is_hidden = true, hidden_at = NOW(), hidden_by = $1
            WHERE id = $2
          `, [userId, decision.contentId]);
        } else {
          await client.query(`
            UPDATE comments
            SET is_hidden = true, hidden_at = NOW(), hidden_by = $1
            WHERE id = $2
          `, [userId, decision.contentId]);
        }

        // Decrease author reputation
        const contentResult = await client.query(`
          SELECT user_id FROM ${decision.contentType}s WHERE id = $1
        `, [decision.contentId]);
        
        if (contentResult.rows.length > 0) {
          await client.query(`
            UPDATE users
            SET reputation_score = reputation_score - 1
            WHERE id = $1
          `, [contentResult.rows[0].user_id]);
        }
      }

      // Mark flags as resolved
      await client.query(`
        UPDATE content_flags
        SET resolved = true, resolved_at = NOW(), resolved_by = $1
        WHERE content_type = $2
        AND content_id = $3
        AND resolved = false
      `, [userId, decision.contentType, decision.contentId]);

      // Update badge action count
      await client.query(`
        UPDATE mod_badges
        SET actions_taken = actions_taken + 1
        WHERE id = $1
      `, [decision.badgeId]);

      // Record on blockchain
      const blockchainTx = await createBlockchainRecord({
        type: 'moderation_action',
        actionId: actionResult.rows[0].id,
        badgeId: decision.badgeId,
        moderatorId: userId,
        contentType: decision.contentType,
        contentId: decision.contentId,
        action: decision.action,
        flagCount: parseInt(flagCount.rows[0].count),
        timestamp: new Date().toISOString()
      });

      // Update action with blockchain hash
      await client.query(`
        UPDATE mod_actions
        SET blockchain_tx_hash = $1
        WHERE id = $2
      `, [blockchainTx.hash, actionResult.rows[0].id]);

      await client.query('COMMIT');

      // Emit appropriate event
      eventEmitter.emit(`moderation:content_${decision.action}ed`, {
        badgeId: decision.badgeId,
        moderatorId: userId,
        contentType: decision.contentType,
        contentId: decision.contentId,
        reason: decision.reason
      });

      logger.info(`Moderation decision submitted: ${decision.action} on ${decision.contentType} ${decision.contentId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error submitting moderation decision:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get moderation statistics for a scope
   */
  async getModerationStats(scopeType: 'group' | 'pillar', scopeId: string): Promise<any> {
    // Get various statistics
    const stats = await this.pool.query(`
      WITH scope_badges AS (
        SELECT * FROM mod_badges
        WHERE scope_type = $1 AND scope_id = $2
      ),
      active_badges AS (
        SELECT * FROM scope_badges WHERE status = 'active'
      ),
      recent_actions AS (
        SELECT ma.*
        FROM mod_actions ma
        INNER JOIN scope_badges sb ON ma.badge_id = sb.id
        WHERE ma.created_at > NOW() - INTERVAL '30 days'
      )
      SELECT 
        (SELECT COUNT(*) FROM active_badges) as active_badges,
        (SELECT COUNT(*) FROM scope_badges WHERE status = 'expired' AND actions_taken >= min_actions_required) as completed_badges,
        (SELECT COUNT(*) FROM recent_actions) as total_actions_30d,
        (SELECT COUNT(*) FROM recent_actions WHERE action = 'remove') as removals_30d,
        (SELECT COUNT(*) FROM recent_actions WHERE action = 'keep') as keeps_30d,
        (SELECT AVG(actions_taken) FROM scope_badges WHERE status = 'expired') as avg_actions_per_badge,
        (SELECT COUNT(DISTINCT badge_id) FROM recent_actions) as unique_moderators_30d
    `, [scopeType, scopeId]);

    // Get pending flags
    let pendingFlagsQuery: string;
    if (scopeType === 'group') {
      pendingFlagsQuery = `
        SELECT COUNT(DISTINCT content_type || ':' || content_id) as count
        FROM content_flags
        WHERE group_id = $1
        AND resolved = false
      `;
    } else {
      pendingFlagsQuery = `
        SELECT COUNT(DISTINCT cf.content_type || ':' || cf.content_id) as count
        FROM content_flags cf
        INNER JOIN groups g ON cf.group_id = g.id
        WHERE g.pillar_id = $1::INTEGER
        AND cf.resolved = false
      `;
    }

    const pendingFlags = await this.pool.query(pendingFlagsQuery, [scopeId]);

    return {
      ...stats.rows[0],
      pending_flags: pendingFlags.rows[0].count,
      scope_type: scopeType,
      scope_id: scopeId
    };
  }

  /**
   * Get badge holder performance metrics
   */
  async getBadgeHolderMetrics(badgeId: string): Promise<any> {
    const result = await this.pool.query(`
      SELECT 
        mb.*,
        u.display_name,
        u.wallet_pub_key,
        (
          SELECT json_agg(json_build_object(
            'content_type', ma.content_type,
            'content_id', ma.content_id,
            'action', ma.action,
            'created_at', ma.created_at
          ) ORDER BY ma.created_at DESC)
          FROM mod_actions ma
          WHERE ma.badge_id = mb.id
        ) as actions,
        CASE 
          WHEN mb.end_date < NOW() THEN 'expired'
          WHEN mb.actions_taken >= mb.min_actions_required THEN 'quota_met'
          ELSE 'in_progress'
        END as completion_status
      FROM mod_badges mb
      INNER JOIN users u ON mb.holder_id = u.id
      WHERE mb.id = $1
    `, [badgeId]);

    return result.rows[0];
  }
}
