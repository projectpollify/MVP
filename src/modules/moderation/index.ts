import { Application } from 'express';
import { Pool } from 'pg';
import { createModerationRoutes } from './routes/moderationRoutes';
import { ModerationCronJobs } from './jobs/moderationCronJobs';
import { eventEmitter } from '../shared/events';
import { logger } from '../shared/logger';

// Export services for use by other modules
export { BadgeAssignmentService } from './services/badgeAssignmentService';
export { BadgeInvitationService } from './services/badgeInvitationService';
export { ModerationQueueService } from './services/moderationQueueService';
export { BadgeRewardsService } from './services/badgeRewardsService';

// Module configuration
export interface ModerationModuleConfig {
  app: Application;
  pool: Pool;
  basePath?: string;
}

// Module instance
class ModerationModule {
  private cronJobs: ModerationCronJobs | null = null;
  private pool: Pool | null = null;

  /**
   * Initialize the moderation module
   */
  async initialize(config: ModerationModuleConfig): Promise<void> {
    const { app, pool, basePath = '/api/v1/moderation' } = config;
    this.pool = pool;

    try {
      // Register routes
      const routes = createModerationRoutes(pool);
      app.use(basePath, routes);
      logger.info(`Moderation routes registered at ${basePath}`);

      // Initialize cron jobs
      this.cronJobs = new ModerationCronJobs(pool);
      this.cronJobs.start();
      logger.info('Moderation cron jobs initialized');

      // Register event listeners
      this.registerEventListeners();
      logger.info('Moderation event listeners registered');

      // Run initial setup
      await this.runInitialSetup();
      
      logger.info('Moderation module initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize moderation module:', error);
      throw error;
    }
  }

  /**
   * Shutdown the module gracefully
   */
  async shutdown(): Promise<void> {
    try {
      if (this.cronJobs) {
        this.cronJobs.stop();
        logger.info('Moderation cron jobs stopped');
      }

      // Remove event listeners
      this.removeEventListeners();
      
      logger.info('Moderation module shutdown complete');
    } catch (error) {
      logger.error('Error during moderation module shutdown:', error);
      throw error;
    }
  }

  /**
   * Register event listeners for moderation events
   */
  private registerEventListeners(): void {
    // Listen for flag events from Module 5
    eventEmitter.on('content:flagged', async (data) => {
      try {
        const { contentType, contentId, groupId, flagCount } = data;
        
        // Check if we need to notify badge holders
        if (flagCount >= 3) {
          await this.notifyBadgeHolders(groupId);
        }
      } catch (error) {
        logger.error('Error handling content:flagged event:', error);
      }
    });

    // Listen for user reputation changes
    eventEmitter.on('user:reputation_changed', async (data) => {
      try {
        const { userId, newReputation } = data;
        
        // Check if user lost badge eligibility
        if (newReputation < 0) {
          await this.checkBadgeEligibilityLoss(userId);
        }
      } catch (error) {
        logger.error('Error handling reputation change:', error);
      }
    });

    // Listen for group/pillar membership changes
    eventEmitter.on('group:member_joined', async (data) => {
      try {
        const { groupId } = data;
        await this.checkBadgeRequirements('group', groupId);
      } catch (error) {
        logger.error('Error handling member joined:', error);
      }
    });
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    eventEmitter.removeAllListeners('content:flagged');
    eventEmitter.removeAllListeners('user:reputation_changed');
    eventEmitter.removeAllListeners('group:member_joined');
  }

  /**
   * Run initial setup tasks
   */
  private async runInitialSetup(): Promise<void> {
    if (!this.pool) return;

    try {
      // Create default configurations for existing groups/pillars without config
      await this.pool.query(`
        INSERT INTO moderation_config (scope_type, scope_id)
        SELECT 'group', g.id
        FROM groups g
        WHERE NOT EXISTS (
          SELECT 1 FROM moderation_config mc
          WHERE mc.scope_type = 'group' AND mc.scope_id = g.id
        )
        ON CONFLICT DO NOTHING
      `);

      await this.pool.query(`
        INSERT INTO moderation_config (scope_type, scope_id)
        SELECT 'pillar', p.id::TEXT
        FROM pillars p
        WHERE NOT EXISTS (
          SELECT 1 FROM moderation_config mc
          WHERE mc.scope_type = 'pillar' AND mc.scope_id = p.id::TEXT
        )
        ON CONFLICT DO NOTHING
      `);

      logger.info('Initial moderation configurations created');
    } catch (error) {
      logger.error('Error in initial setup:', error);
      // Don't throw - initial setup errors shouldn't prevent module start
    }
  }

  /**
   * Notify badge holders about new flagged content
   */
  private async notifyBadgeHolders(groupId: string): Promise<void> {
    if (!this.pool) return;

    try {
      // Get active badge holders for this group
      const badgeHolders = await this.pool.query(`
        SELECT DISTINCT u.id, u.display_name
        FROM mod_badges mb
        INNER JOIN users u ON mb.holder_id = u.id
        WHERE mb.status = 'active'
        AND (
          (mb.scope_type = 'group' AND mb.scope_id = $1)
          OR (mb.scope_type = 'pillar' AND mb.scope_id = (
            SELECT pillar_id::TEXT FROM groups WHERE id = $1
          ))
        )
      `, [groupId]);

      // Emit notification events for each badge holder
      for (const holder of badgeHolders.rows) {
        eventEmitter.emit('notification:send', {
          userId: holder.id,
          type: 'moderation_queue_update',
          title: 'New Content to Review',
          message: 'New flagged content is available in your moderation queue',
          data: { groupId }
        });
      }
    } catch (error) {
      logger.error('Error notifying badge holders:', error);
    }
  }

  /**
   * Check if user lost badge eligibility
   */
  private async checkBadgeEligibilityLoss(userId: string): Promise<void> {
    if (!this.pool) return;

    try {
      // Check if user has active badge
      const activeBadge = await this.pool.query(`
        SELECT id FROM mod_badges
        WHERE holder_id = $1
        AND status = 'active'
      `, [userId]);

      if (activeBadge.rows.length > 0) {
        // User no longer eligible but has active badge
        // This is handled by the badge holder - they can complete their duty
        logger.warn(`User ${userId} lost eligibility but has active badge ${activeBadge.rows[0].id}`);
      }
    } catch (error) {
      logger.error('Error checking badge eligibility loss:', error);
    }
  }

  /**
   * Check if badge requirements changed for a scope
   */
  private async checkBadgeRequirements(scopeType: string, scopeId: string): Promise<void> {
    if (!this.pool) return;

    try {
      const { BadgeAssignmentService } = require('./services/badgeAssignmentService');
      const assignmentService = new BadgeAssignmentService(this.pool);
      await assignmentService.checkAndAssignBadges(scopeType as 'group' | 'pillar', scopeId);
    } catch (error) {
      logger.error('Error checking badge requirements:', error);
    }
  }
}

// Export singleton instance
export const moderationModule = new ModerationModule();

// Export types
export interface ModerationBadge {
  id: string;
  scopeType: 'group' | 'pillar';
  scopeId: string;
  holderId: string;
  status: 'offered' | 'active' | 'expired' | 'declined' | 'abandoned';
  dutyDays: number;
  startDate?: Date;
  endDate?: Date;
  actionsTaken: number;
  minActionsRequired: number;
}

export interface ModerationAction {
  id: string;
  badgeId: string;
  contentType: 'post' | 'comment';
  contentId: string;
  action: 'keep' | 'remove';
  reason?: string;
  flagsAtReview: number;
  createdAt: Date;
}

export interface ModerationStats {
  activeBadges: number;
  completedBadges: number;
  totalActions30d: number;
  removals30d: number;
  keeps30d: number;
  avgActionsPerBadge: number;
  uniqueModerators30d: number;
  pendingFlags: number;
}
