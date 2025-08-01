/**
 * Staking Module API Routes
 * Endpoints for stake management, rewards, and statistics
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../auth/middleware/auth.middleware';
import { StakingService } from '../services/staking.service';
import { StakingStatsService } from '../services/stats.service';
import { STAKING_POOLS } from '../config/pools.config';
import { StakeRequest, UnstakeRequest } from '../types/staking.types';

// Extended Request type with user
interface AuthRequest extends Request {
  user: {
    id: string;
    walletAddress: string;
  };
}

export function createStakingRoutes(
  stakingService: StakingService,
  statsService: StakingStatsService
): Router {
  const router = Router();

  /**
   * GET /api/v1/staking/pools
   * List all available staking pools with their configurations
   */
  router.get('/pools', async (req: Request, res: Response) => {
    try {
      const pools = await stakingService.getActivePools();
      
      res.json({
        success: true,
        data: pools,
        error: null
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        data: null,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/staking/my-stakes
   * Get all stakes for the authenticated user
   */
  router.get('/my-stakes', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const stakes = await stakingService.getUserStakes(userId);
      
      // Calculate current rewards for each active stake
      const stakesWithRewards = await Promise.all(
        stakes.map(async (stake) => {
          if (stake.status === 'active') {
            const rewards = await stakingService.calculateCurrentRewards(stake.id, userId);
            return { ...stake, currentRewards: rewards };
          }
          return stake;
        })
      );
      
      res.json({
        success: true,
        data: stakesWithRewards,
        error: null
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        data: null,
        error: error.message
      });
    }
  });

  /**
   * POST /api/v1/staking/stake
   * Create a new stake
   * Body: { poolId: number, amount: number }
   */
  router.post('/stake', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const walletAddress = req.user.walletAddress;
      
      const stakeRequest: StakeRequest = {
        poolId: req.body.poolId,
        amount: req.body.amount,
        walletAddress
      };
      
      // Validate request
      if (!stakeRequest.poolId || !stakeRequest.amount) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'Pool ID and amount are required'
        });
      }
      
      const stake = await stakingService.createStake(stakeRequest, userId);
      
      res.json({
        success: true,
        data: stake,
        error: null
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        data: null,
        error: error.message
      });
    }
  });

  /**
   * POST /api/v1/staking/unstake/:id
   * Unstake tokens (normal or early exit)
   */
  router.post('/unstake/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const stakeId = req.params.id;
      
      const unstakeRequest: UnstakeRequest = {
        stakeId,
        isEarlyExit: req.body.isEarlyExit || false
      };
      
      const result = await stakingService.unstake(unstakeRequest, userId);
      
      res.json({
        success: true,
        data: result,
        error: null
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        data: null,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/staking/calculate/:id
   * Calculate current rewards for a specific stake
   */
  router.get('/calculate/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const stakeId = req.params.id;
      
      const rewards = await stakingService.calculateCurrentRewards(stakeId, userId);
      
      res.json({
        success: true,
        data: rewards,
        error: null
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        data: null,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/staking/stats
   * Get platform-wide staking statistics
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const stats = await statsService.getPlatformStats();
      
      res.json({
        success: true,
        data: stats,
        error: null
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        data: null,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/staking/stats/user/:wallet
   * Get staking statistics for a specific user
   */
  router.get('/stats/user/:wallet', async (req: Request, res: Response) => {
    try {
      const walletAddress = req.params.wallet;
      const userStats = await statsService.getUserStats(walletAddress);
      
      res.json({
        success: true,
        data: userStats,
        error: null
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        data: null,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/staking/estimate
   * Estimate rewards for a potential stake
   * Query params: poolId, amount, days (optional)
   */
  router.get('/estimate', async (req: Request, res: Response) => {
    try {
      const poolId = parseInt(req.query.poolId as string);
      const amount = parseFloat(req.query.amount as string);
      const days = req.query.days ? parseInt(req.query.days as string) : null;
      
      if (!poolId || !amount) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'Pool ID and amount are required'
        });
      }
      
      const pool = STAKING_POOLS.find(p => p.id === poolId);
      if (!pool) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'Invalid pool ID'
        });
      }
      
      const estimate = await stakingService.estimateRewards(
        amount,
        pool.aprRate,
        days || pool.lockDays
      );
      
      res.json({
        success: true,
        data: estimate,
        error: null
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        data: null,
        error: error.message
      });
    }
  });

  return router;
}
