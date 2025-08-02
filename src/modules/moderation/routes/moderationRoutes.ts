import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../../auth/middleware/authMiddleware';
import { BadgeAssignmentService } from '../services/badgeAssignmentService';
import { BadgeInvitationService } from '../services/badgeInvitationService';
import { ModerationQueueService } from '../services/moderationQueueService';
import { BadgeRewardsService } from '../services/badgeRewardsService';
import { validateRequest } from '../../shared/middleware/validation';
import { logger } from '../../shared/logger';

export function createModerationRoutes(pool: Pool): Router {
  const router = Router();
  const assignmentService = new BadgeAssignmentService(pool);
  const invitationService = new BadgeInvitationService(pool);
  const queueService = new ModerationQueueService(pool);
  const rewardsService = new BadgeRewardsService(pool);

  // All routes require authentication
  router.use(authenticate);

  /**
   * GET /api/v1/moderation/eligibility
   * Check if current user is eligible for badges
   */
  router.get('/eligibility', async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const eligibility = await invitationService.checkUserEligibility(userId);
      
      res.json({
        success: true,
        data: eligibility
      });
    } catch (error) {
      logger.error('Error checking eligibility:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check eligibility'
      });
    }
  });

  /**
   * GET /api/v1/moderation/invitations
   * Get user's pending badge invitations
   */
  router.get('/invitations', async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const invitations = await invitationService.getUserInvitations(userId);
      
      res.json({
        success: true,
        data: invitations
      });
    } catch (error) {
      logger.error('Error fetching invitations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch invitations'
      });
    }
  });

  /**
   * POST /api/v1/moderation/accept/:badgeId
   * Accept a badge invitation
   */
  router.post('/accept/:badgeId', 
    validateRequest({
      params: {
        badgeId: { type: 'uuid', required: true }
      }
    }),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const { badgeId } = req.params;
        
        await invitationService.acceptInvitation(userId, badgeId);
        
        res.json({
          success: true,
          data: {
            message: 'Badge invitation accepted successfully'
          }
        });
      } catch (error: any) {
        logger.error('Error accepting invitation:', error);
        res.status(400).json({
          success: false,
          error: error.message || 'Failed to accept invitation'
        });
      }
    }
  );

  /**
   * POST /api/v1/moderation/decline/:badgeId
   * Decline a badge invitation
   */
  router.post('/decline/:badgeId',
    validateRequest({
      params: {
        badgeId: { type: 'uuid', required: true }
      }
    }),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const { badgeId } = req.params;
        
        await invitationService.declineInvitation(userId, badgeId);
        
        res.json({
          success: true,
          data: {
            message: 'Badge invitation declined'
          }
        });
      } catch (error: any) {
        logger.error('Error declining invitation:', error);
        res.status(400).json({
          success: false,
          error: error.message || 'Failed to decline invitation'
        });
      }
    }
  );

  /**
   * GET /api/v1/moderation/queue
   * Get moderation queue for badge holders
   */
  router.get('/queue', async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      
      // Get user's active badge
      const activeBadge = await invitationService.getUserActiveBadge(userId);
      if (!activeBadge) {
        return res.status(403).json({
          success: false,
          error: 'No active moderation badge'
        });
      }
      
      const queue = await queueService.getModerationQueue(userId, activeBadge.id);
      
      res.json({
        success: true,
        data: {
          badge: activeBadge,
          queue: queue
        }
      });
    } catch (error: any) {
      logger.error('Error fetching moderation queue:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch moderation queue'
      });
    }
  });

  /**
   * POST /api/v1/moderation/review
   * Submit moderation decision
   */
  router.post('/review',
    validateRequest({
      body: {
        badgeId: { type: 'uuid', required: true },
        contentType: { type: 'string', enum: ['post', 'comment'], required: true },
        contentId: { type: 'uuid', required: true },
        action: { type: 'string', enum: ['keep', 'remove'], required: true },
        reason: { type: 'string', required: false }
      }
    }),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const decision = req.body;
        
        await queueService.submitModerationDecision(userId, decision);
        
        res.json({
          success: true,
          data: {
            message: 'Moderation decision submitted successfully'
          }
        });
      } catch (error: any) {
        logger.error('Error submitting moderation decision:', error);
        res.status(400).json({
          success: false,
          error: error.message || 'Failed to submit decision'
        });
      }
    }
  );

  /**
   * GET /api/v1/moderation/my-badge
   * Get current badge status for user
   */
  router.get('/my-badge', async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const badge = await invitationService.getUserActiveBadge(userId);
      
      res.json({
        success: true,
        data: badge
      });
    } catch (error) {
      logger.error('Error fetching user badge:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch badge status'
      });
    }
  });

  /**
   * POST /api/v1/moderation/pass-badge
   * Emergency option to pass badge to next user
   */
  router.post('/pass-badge',
    validateRequest({
      body: {
        badgeId: { type: 'uuid', required: true },
        reason: { type: 'string', required: true, minLength: 10 }
      }
    }),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const { badgeId, reason } = req.body;
        
        await invitationService.passBadge(userId, badgeId, reason);
        
        res.json({
          success: true,
          data: {
            message: 'Badge passed to next eligible user'
          }
        });
      } catch (error: any) {
        logger.error('Error passing badge:', error);
        res.status(400).json({
          success: false,
          error: error.message || 'Failed to pass badge'
        });
      }
    }
  );

  /**
   * GET /api/v1/moderation/stats/:scopeType/:scopeId
   * Get moderation statistics for a scope
   */
  router.get('/stats/:scopeType/:scopeId',
    validateRequest({
      params: {
        scopeType: { type: 'string', enum: ['group', 'pillar'], required: true },
        scopeId: { type: 'string', required: true }
      }
    }),
    async (req: Request, res: Response) => {
      try {
        const { scopeType, scopeId } = req.params;
        const stats = await queueService.getModerationStats(
          scopeType as 'group' | 'pillar', 
          scopeId
        );
        
        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        logger.error('Error fetching moderation stats:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch statistics'
        });
      }
    }
  );

  /**
   * GET /api/v1/moderation/leaderboard
   * Get top moderators leaderboard
   */
  router.get('/leaderboard', async (req: Request, res: Response) => {
    try {
      const { scopeType, scopeId, timeframe = 'month' } = req.query;
      
      const leaderboard = await rewardsService.getModeratorLeaderboard(
        scopeType as 'group' | 'pillar' | undefined,
        scopeId as string | undefined,
        timeframe as 'week' | 'month' | 'all'
      );
      
      res.json({
        success: true,
        data: leaderboard
      });
    } catch (error) {
      logger.error('Error fetching leaderboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch leaderboard'
      });
    }
  });

  /**
   * GET /api/v1/moderation/badge/:badgeId/performance
   * Get performance metrics for a specific badge
   */
  router.get('/badge/:badgeId/performance',
    validateRequest({
      params: {
        badgeId: { type: 'uuid', required: true }
      }
    }),
    async (req: Request, res: Response) => {
      try {
        const { badgeId } = req.params;
        const performance = await rewardsService.calculateBadgePerformance(badgeId);
        
        res.json({
          success: true,
          data: performance
        });
      } catch (error) {
        logger.error('Error fetching badge performance:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch performance data'
        });
      }
    }
  );

  /**
   * POST /api/v1/moderation/batch-review
   * Submit multiple moderation decisions at once
   */
  router.post('/batch-review',
    validateRequest({
      body: {
        badgeId: { type: 'uuid', required: true },
        decisions: {
          type: 'array',
          items: {
            contentType: { type: 'string', enum: ['post', 'comment'], required: true },
            contentId: { type: 'uuid', required: true },
            action: { type: 'string', enum: ['keep', 'remove'], required: true },
            reason: { type: 'string', required: false }
          },
          required: true,
          minItems: 1,
          maxItems: 20
        }
      }
    }),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const { badgeId, decisions } = req.body;
        
        const results = [];
        for (const decision of decisions) {
          try {
            await queueService.submitModerationDecision(userId, {
              badgeId,
              ...decision
            });
            results.push({ 
              contentId: decision.contentId, 
              success: true 
            });
          } catch (error: any) {
            results.push({ 
              contentId: decision.contentId, 
              success: false, 
              error: error.message 
            });
          }
        }
        
        res.json({
          success: true,
          data: {
            processed: results.length,
            successful: results.filter(r => r.success).length,
            results
          }
        });
      } catch (error) {
        logger.error('Error in batch review:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to process batch review'
        });
      }
    }
  );

  return router;
}
