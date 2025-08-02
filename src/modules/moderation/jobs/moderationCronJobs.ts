import { CronJob } from 'cron';
import { Pool } from 'pg';
import { BadgeAssignmentService } from '../services/badgeAssignmentService';
import { BadgeRewardsService } from '../services/badgeRewardsService';
import { logger } from '../../shared/logger';

export class ModerationCronJobs {
  private pool: Pool;
  private assignmentService: BadgeAssignmentService;
  private rewardsService: BadgeRewardsService;
  private jobs: CronJob[] = [];

  constructor(pool: Pool) {
    this.pool = pool;
    this.assignmentService = new BadgeAssignmentService(pool);
    this.rewardsService = new BadgeRewardsService(pool);
  }

  /**
   * Start all moderation cron jobs
   */
  start(): void {
    logger.info('Starting moderation cron jobs...');

    // Run every hour - Check badge balance and create new badges
    const badgeBalanceJob = new CronJob('0 * * * *', async () => {
      try {
        logger.info('Running badge balance check...');
        await this.checkAllScopesBadgeBalance();
      } catch (error) {
        logger.error('Error in badge balance job:', error);
      }
    });

    // Run every hour - Process invitation timeouts
    const timeoutJob = new CronJob('30 * * * *', async () => {
      try {
        logger.info('Processing invitation timeouts...');
        await this.assignmentService.processInvitationTimeouts();
      } catch (error) {
        logger.error('Error in timeout processing job:', error);
      }
    });

    // Run every hour - Expire badges and distribute rewards
    const expirationJob = new CronJob('15 * * * *', async () => {
      try {
        logger.info('Processing expired badges...');
        await this.rewardsService.processExpiredBadges();
      } catch (error) {
        logger.error('Error in badge expiration job:', error);
      }
    });

    // Run daily at 2 AM - Calculate moderator performance
    const performanceJob = new CronJob('0 2 * * *', async () => {
      try {
        logger.info('Calculating moderator performance metrics...');
        await this.calculateDailyPerformance();
      } catch (error) {
        logger.error('Error in performance calculation job:', error);
      }
    });

    // Run daily at 3 AM - Update moderation statistics
    const statsJob = new CronJob('0 3 * * *', async () => {
      try {
        logger.info('Updating moderation statistics...');
        await this.updateModerationStats();
      } catch (error) {
        logger.error('Error in stats update job:', error);
      }
    });

    // Run every 6 hours - Clean up old data
    const cleanupJob = new CronJob('0 */6 * * *', async () => {
      try {
        logger.info('Running moderation data cleanup...');
        await this.cleanupOldData();
      } catch (error) {
        logger.error('Error in cleanup job:', error);
      }
    });

    // Store jobs and start them
    this.jobs = [
      badgeBalanceJob,
      timeoutJob,
      expirationJob,
      performanceJob,
      statsJob,
      cleanupJob
    ];

    this.jobs.forEach(job => job.start());
    logger.info('All moderation cron jobs started successfully');
  }

  /**
   * Stop all cron jobs
   */
  stop(): void {
    this.jobs.forEach(job => job.stop());
    logger.info('All moderation cron jobs stopped');
  }

  /**
   * Check badge balance for all active scopes
   */
  private async checkAllScopesBadgeBalance(): Promise<void> {
    try {
      // Get all active groups
      const activeGroups = await this.pool.query(`
        SELECT DISTINCT g.id
        FROM groups g
        WHERE g.is_active = true
        AND EXISTS (
          SELECT 1 FROM group_members gm
          WHERE gm.group_id = g.id
        )
      `);

      // Check each group
      for (const group of activeGroups.rows) {
        try {
          await this.assignmentService.checkAndAssignBadges('group', group.id);
        } catch (error) {
          logger.error(`Error checking badges for group ${group.id}:`, error);
        }
      }

      // Get all active pillars
      const activePillars = await this.pool.query(`
        SELECT DISTINCT p.id
        FROM pillars p
        WHERE EXISTS (
          SELECT 1 FROM users u
          WHERE u.pillar_id = p.id
          AND u.mode = true
        )
      `);

      // Check each pillar
      for (const pillar of activePillars.rows) {
        try {
          await this.assignmentService.checkAndAssignBadges('pillar', pillar.id.toString());
        } catch (error) {
          logger.error(`Error checking badges for pillar ${pillar.id}:`, error);
        }
      }

      logger.info(`Badge balance check completed for ${activeGroups.rows.length} groups and ${activePillars.rows.length} pillars`);
    } catch (error) {
      logger.error('Error in badge balance check:', error);
      throw error;
    }
  }

  /**
   * Calculate daily performance metrics
   */
  private async calculateDailyPerformance(): Promise<void> {
    try {
      // Calculate performance for badges that ended yesterday
      const result = await this.pool.query(`
        INSERT INTO moderation_daily_stats (
          date,
          scope_type,
          scope_id,
          badges_completed,
          badges_abandoned,
          total_actions,
          avg_actions_per_badge,
          unique_moderators,
          content_removed,
          content_kept
        )
        SELECT 
          DATE(mb.end_date) as date,
          mb.scope_type,
          mb.scope_id,
          COUNT(CASE WHEN mb.actions_taken >= mb.min_actions_required THEN 1 END) as badges_completed,
          COUNT(CASE WHEN mb.actions_taken < mb.min_actions_required THEN 1 END) as badges_abandoned,
          SUM(mb.actions_taken) as total_actions,
          AVG(mb.actions_taken) as avg_actions_per_badge,
          COUNT(DISTINCT mb.holder_id) as unique_moderators,
          COUNT(DISTINCT CASE WHEN ma.action = 'remove' THEN ma.content_id END) as content_removed,
          COUNT(DISTINCT CASE WHEN ma.action = 'keep' THEN ma.content_id END) as content_kept
        FROM mod_badges mb
        LEFT JOIN mod_actions ma ON mb.id = ma.badge_id
        WHERE mb.status = 'expired'
        AND DATE(mb.end_date) = CURRENT_DATE - INTERVAL '1 day'
        GROUP BY DATE(mb.end_date), mb.scope_type, mb.scope_id
        ON CONFLICT (date, scope_type, scope_id) DO UPDATE
        SET 
          badges_completed = EXCLUDED.badges_completed,
          badges_abandoned = EXCLUDED.badges_abandoned,
          total_actions = EXCLUDED.total_actions,
          avg_actions_per_badge = EXCLUDED.avg_actions_per_badge,
          unique_moderators = EXCLUDED.unique_moderators,
          content_removed = EXCLUDED.content_removed,
          content_kept = EXCLUDED.content_kept,
          updated_at = NOW()
      `);

      logger.info(`Daily performance calculated for ${result.rowCount} scopes`);
    } catch (error) {
      logger.error('Error calculating daily performance:', error);
      throw error;
    }
  }

  /**
   * Update moderation statistics cache
   */
  private async updateModerationStats(): Promise<void> {
    try {
      // Update global moderation stats
      await this.pool.query(`
        INSERT INTO moderation_stats_cache (
          stat_type,
          stat_value,
          metadata
        )
        SELECT 
          'global_overview' as stat_type,
          json_build_object(
            'total_badges_issued', COUNT(*),
            'active_badges', COUNT(CASE WHEN status = 'active' THEN 1 END),
            'completion_rate', 
              CASE 
                WHEN COUNT(CASE WHEN status = 'expired' THEN 1 END) > 0
                THEN ROUND(
                  COUNT(CASE WHEN status = 'expired' AND actions_taken >= min_actions_required THEN 1 END)::NUMERIC / 
                  COUNT(CASE WHEN status = 'expired' THEN 1 END) * 100, 2
                )
                ELSE 0
              END,
            'total_actions', SUM(actions_taken),
            'unique_moderators', COUNT(DISTINCT holder_id)
          ) as stat_value,
          json_build_object(
            'calculated_at', NOW()
          ) as metadata
        FROM mod_badges
        ON CONFLICT (stat_type) DO UPDATE
        SET 
          stat_value = EXCLUDED.stat_value,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `);

      // Update per-scope stats
      await this.pool.query(`
        INSERT INTO moderation_stats_cache (
          stat_type,
          scope_type,
          scope_id,
          stat_value,
          metadata
        )
        SELECT 
          'scope_overview' as stat_type,
          mb.scope_type,
          mb.scope_id,
          json_build_object(
            'active_badges', COUNT(CASE WHEN mb.status = 'active' THEN 1 END),
            'pending_flags', COALESCE(fc.flag_count, 0),
            'avg_response_time_hours', 
              EXTRACT(EPOCH FROM AVG(ma.created_at - cf.created_at)) / 3600,
            'removal_rate',
              CASE 
                WHEN COUNT(ma.id) > 0
                THEN ROUND(
                  COUNT(CASE WHEN ma.action = 'remove' THEN 1 END)::NUMERIC / 
                  COUNT(ma.id) * 100, 2
                )
                ELSE 0
              END
          ) as stat_value,
          json_build_object(
            'calculated_at', NOW()
          ) as metadata
        FROM mod_badges mb
        LEFT JOIN mod_actions ma ON mb.id = ma.badge_id
        LEFT JOIN content_flags cf ON ma.content_type = cf.content_type AND ma.content_id = cf.content_id
        LEFT JOIN LATERAL (
          SELECT COUNT(DISTINCT cf2.content_id) as flag_count
          FROM content_flags cf2
          WHERE cf2.resolved = false
          AND (
            (mb.scope_type = 'group' AND cf2.group_id = mb.scope_id)
            OR (mb.scope_type = 'pillar' AND EXISTS (
              SELECT 1 FROM groups g 
              WHERE g.pillar_id = mb.scope_id::INTEGER 
              AND g.id = cf2.group_id
            ))
          )
        ) fc ON true
        GROUP BY mb.scope_type, mb.scope_id, fc.flag_count
        ON CONFLICT (stat_type, scope_type, scope_id) DO UPDATE
        SET 
          stat_value = EXCLUDED.stat_value,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `);

      logger.info('Moderation statistics updated successfully');
    } catch (error) {
      logger.error('Error updating moderation stats:', error);
      throw error;
    }
  }

  /**
   * Clean up old data
   */
  private async cleanupOldData(): Promise<void> {
    try {
      // Remove old declined/timeout invitations (older than 30 days)
      const invitationCleanup = await this.pool.query(`
        DELETE FROM badge_invitations
        WHERE response IN ('declined', 'timeout')
        AND responded_at < NOW() - INTERVAL '30 days'
      `);

      // Archive old moderation actions (older than 90 days)
      const archiveActions = await this.pool.query(`
        INSERT INTO mod_actions_archive
        SELECT * FROM mod_actions
        WHERE created_at < NOW() - INTERVAL '90 days'
        ON CONFLICT DO NOTHING
      `);

      const deleteActions = await this.pool.query(`
        DELETE FROM mod_actions
        WHERE created_at < NOW() - INTERVAL '90 days'
        AND EXISTS (
          SELECT 1 FROM mod_actions_archive
          WHERE mod_actions_archive.id = mod_actions.id
        )
      `);

      logger.info(`Cleanup completed: ${invitationCleanup.rowCount} invitations removed, ${deleteActions.rowCount} actions archived`);
    } catch (error) {
      logger.error('Error in cleanup job:', error);
      // Don't throw - cleanup errors shouldn't stop other jobs
    }
  }
}

// Create the archive table if it doesn't exist
export const createArchiveTable = `
  CREATE TABLE IF NOT EXISTS mod_actions_archive (
    LIKE mod_actions INCLUDING ALL
  );
  
  CREATE TABLE IF NOT EXISTS moderation_daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    scope_type VARCHAR(50) NOT NULL,
    scope_id UUID NOT NULL,
    badges_completed INTEGER DEFAULT 0,
    badges_abandoned INTEGER DEFAULT 0,
    total_actions INTEGER DEFAULT 0,
    avg_actions_per_badge NUMERIC(10,2),
    unique_moderators INTEGER DEFAULT 0,
    content_removed INTEGER DEFAULT 0,
    content_kept INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(date, scope_type, scope_id)
  );
  
  CREATE TABLE IF NOT EXISTS moderation_stats_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_type VARCHAR(100) NOT NULL,
    scope_type VARCHAR(50),
    scope_id UUID,
    stat_value JSONB NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(stat_type, scope_type, scope_id)
  );
`;
