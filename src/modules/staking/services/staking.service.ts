/**
 * Staking Service
 * Core business logic for staking operations
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from '../../../core/events';
import { STAKING_POOLS, STAKING_CONSTANTS, calculateUnlockDate } from '../config/pools.config';
import { 
  UserStake, 
  StakeStatus, 
  StakeRequest, 
  UnstakeRequest,
  StakingEvent 
} from '../types/staking.types';
import { 
  calculateStakeRewards, 
  calculateRewards,
  validateStakeAmount,
  toMicroPCO,
  fromMicroPCO 
} from '../utils/calculations';

export class StakingService {
  private db: Pool;
  private eventEmitter: EventEmitter;
  private blockchainModule: any; // Module 4's blockchain module

  constructor(
    db: Pool, 
    eventEmitter: EventEmitter,
    blockchainModule: any
  ) {
    this.db = db;
    this.eventEmitter = eventEmitter;
    this.blockchainModule = blockchainModule;
  }

  /**
   * Create a new stake
   */
  async createStake(request: StakeRequest, userId: string): Promise<UserStake> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Validate stake amount
      const validation = validateStakeAmount(request.amount);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 2. Check if pool exists and is active
      const poolResult = await client.query(
        'SELECT * FROM staking_pools WHERE id = $1 AND is_active = true',
        [request.poolId]
      );
      
      if (poolResult.rows.length === 0) {
        throw new Error('Invalid or inactive staking pool');
      }
      
      const pool = poolResult.rows[0];

      // 3. Check if user already has an active stake in this pool
      const existingStake = await client.query(
        'SELECT id FROM user_stakes WHERE user_id = $1 AND pool_id = $2 AND status = $3',
        [userId, request.poolId, StakeStatus.ACTIVE]
      );
      
      if (existingStake.rows.length > 0) {
        throw new Error('You already have an active stake in this pool');
      }

      // 4. Check user has sufficient balance using Module 4's method
      const cardanoService = this.blockchainModule.getCardanoService();
      const balance = await cardanoService.getTokenBalance(request.walletAddress, 'PCO');
      
      if (balance < request.amount) {
        throw new Error('Insufficient PCO balance');
      }

      // 5. Transfer tokens to staking contract using Module 4's method
      const stakingContractAddress = process.env.STAKING_CONTRACT_ADDRESS || 'addr1_staking_contract';
      const tokenRegistry = this.blockchainModule.getTokenRegistry();
      
      const stakeTx = await tokenRegistry.transferToken(
        request.walletAddress,
        stakingContractAddress,
        request.amount,
        'PCO'
      );

      // 6. Create stake record
      const stakeId = uuidv4();
      const unlockDate = calculateUnlockDate(pool.lock_days);
      
      const stakeResult = await client.query(
        `INSERT INTO user_stakes 
         (id, user_id, pool_id, stake_amount, stake_date, unlock_date, status, tx_hash_stake)
         VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7)
         RETURNING *`,
        [
          stakeId,
          userId,
          request.poolId,
          request.amount,
          unlockDate,
          StakeStatus.ACTIVE,
          stakeTx.txHash
        ]
      );

      // 7. Update pool total staked
      await client.query(
        'UPDATE staking_pools SET total_staked = total_staked + $1 WHERE id = $2',
        [request.amount, request.poolId]
      );

      // 8. Create blockchain record using Module 4's method
      await cardanoService.createRecord({
        type: 'stake_created',
        data: {
          stakeId,
          userId,
          poolId: request.poolId,
          amount: request.amount,
          unlockDate: unlockDate.toISOString(),
          txHash: stakeTx.txHash
        }
      });

      await client.query('COMMIT');

      // 9. Emit event
      this.emitStakingEvent('stake:created', {
        stakeId,
        userId,
        poolId: request.poolId,
        amount: request.amount
      });

      return this.mapToUserStake(stakeResult.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Unstake tokens (normal or early exit)
   */
  async unstake(request: UnstakeRequest, userId: string): Promise<UserStake> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Get stake details
      const stakeResult = await client.query(
        `SELECT s.*, p.apr_rate, p.early_penalty_rate, p.lock_days
         FROM user_stakes s
         JOIN staking_pools p ON s.pool_id = p.id
         WHERE s.id = $1 AND s.user_id = $2 AND s.status = $3`,
        [request.stakeId, userId, StakeStatus.ACTIVE]
      );
      
      if (stakeResult.rows.length === 0) {
        throw new Error('Active stake not found');
      }
      
      const stake = stakeResult.rows[0];
      const now = new Date();
      const isEarlyExit = now < new Date(stake.unlock_date);

      // 2. Get user's wallet address
      const userResult = await client.query(
        'SELECT wallet_pub_key FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const userWalletAddress = userResult.rows[0].wallet_pub_key;

      // 3. Calculate rewards
      const rewardCalc = calculateStakeRewards(
        stake.id,
        parseFloat(stake.stake_amount),
        new Date(stake.stake_date),
        parseFloat(stake.apr_rate),
        isEarlyExit ? parseFloat(stake.early_penalty_rate) : undefined,
        now
      );

      // 4. Execute unstake on blockchain
      const stakingContractAddress = process.env.STAKING_CONTRACT_ADDRESS || 'addr1_staking_contract';
      const tokenRegistry = this.blockchainModule.getTokenRegistry();
      const cardanoService = this.blockchainModule.getCardanoService();
      let unstakeTx;
      
      if (isEarlyExit) {
        // Early exit with penalty
        // Transfer principal + net rewards back to user
        const userTx = await tokenRegistry.transferToken(
          stakingContractAddress,
          userWalletAddress,
          parseFloat(stake.stake_amount) + rewardCalc.netReward,
          'PCO'
        );
        
        // Record the penalty burn if there's a penalty
        if (rewardCalc.penaltyAmount && rewardCalc.penaltyAmount > 0) {
          const burnAddress = process.env.STAKING_BURN_ADDRESS || 'addr1w8phkx6acpnf78fuvxn0mkew3l0fd058hzquvz7w36x4gtcyjy7wx';
          await tokenRegistry.transferToken(
            stakingContractAddress,
            burnAddress,
            rewardCalc.penaltyAmount,
            'PCO'
          );
        }
        
        unstakeTx = { txHash: userTx.txHash };
      } else {
        // Normal unstake - transfer principal + full rewards
        const userTx = await tokenRegistry.transferToken(
          stakingContractAddress,
          userWalletAddress,
          parseFloat(stake.stake_amount) + rewardCalc.currentReward,
          'PCO'
        );
        
        unstakeTx = { txHash: userTx.txHash };
      }

      // 5. Update stake record
      const updateResult = await client.query(
        `UPDATE user_stakes 
         SET status = $1, unstake_date = NOW(), reward_amount = $2, 
             penalty_amount = $3, tx_hash_unstake = $4
         WHERE id = $5
         RETURNING *`,
        [
          isEarlyExit ? StakeStatus.EARLY_EXIT : StakeStatus.COMPLETED,
          rewardCalc.netReward,
          rewardCalc.penaltyAmount || 0,
          unstakeTx.txHash,
          request.stakeId
        ]
      );

      // 6. Update pool total staked
      await client.query(
        'UPDATE staking_pools SET total_staked = total_staked - $1 WHERE id = $2',
        [stake.stake_amount, stake.pool_id]
      );

      // 7. Record rewards
      await client.query(
        `INSERT INTO staking_rewards 
         (stake_id, reward_amount, penalty_amount, claimed, tx_hash)
         VALUES ($1, $2, $3, true, $4)`,
        [
          request.stakeId,
          rewardCalc.currentReward,
          rewardCalc.penaltyAmount || 0,
          unstakeTx.txHash
        ]
      );

      // 8. Create blockchain record
      await cardanoService.createRecord({
        type: isEarlyExit ? 'stake_early_exit' : 'stake_completed',
        data: {
          stakeId: request.stakeId,
          userId,
          amount: stake.stake_amount,
          rewards: rewardCalc.netReward,
          penalty: rewardCalc.penaltyAmount || 0,
          txHash: unstakeTx.txHash
        }
      });

      await client.query('COMMIT');

      // 9. Emit event
      this.emitStakingEvent(
        isEarlyExit ? 'stake:early_exit' : 'stake:completed',
        {
          stakeId: request.stakeId,
          userId,
          amount: parseFloat(stake.stake_amount),
          rewards: rewardCalc.netReward,
          penalty: rewardCalc.penaltyAmount
        }
      );

      return this.mapToUserStake(updateResult.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user's active stakes
   */
  async getUserStakes(userId: string): Promise<UserStake[]> {
    const result = await this.db.query(
      `SELECT s.*, p.pool_name, p.apr_rate, p.lock_days
       FROM user_stakes s
       JOIN staking_pools p ON s.pool_id = p.id
       WHERE s.user_id = $1
       ORDER BY s.stake_date DESC`,
      [userId]
    );
    
    return result.rows.map(row => this.mapToUserStake(row));
  }

  /**
   * Calculate current rewards for a stake
   */
  async calculateCurrentRewards(stakeId: string, userId: string) {
    const result = await this.db.query(
      `SELECT s.*, p.apr_rate, p.early_penalty_rate
       FROM user_stakes s
       JOIN staking_pools p ON s.pool_id = p.id
       WHERE s.id = $1 AND s.user_id = $2`,
      [stakeId, userId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Stake not found');
    }
    
    const stake = result.rows[0];
    const now = new Date();
    const isEarlyExit = now < new Date(stake.unlock_date);
    
    return calculateStakeRewards(
      stake.id,
      parseFloat(stake.stake_amount),
      new Date(stake.stake_date),
      parseFloat(stake.apr_rate),
      isEarlyExit ? parseFloat(stake.early_penalty_rate) : undefined,
      now
    );
  }

  /**
   * Get all active staking pools
   */
  async getActivePools() {
    const result = await this.db.query(
      `SELECT 
        p.*,
        COUNT(s.id) as active_stakes_count,
        COALESCE(SUM(CASE WHEN s.status = 'active' THEN s.stake_amount ELSE 0 END), 0) as current_total_staked
       FROM staking_pools p
       LEFT JOIN user_stakes s ON p.id = s.pool_id AND s.status = 'active'
       WHERE p.is_active = true
       GROUP BY p.id
       ORDER BY p.lock_days ASC`
    );
    
    return result.rows.map(row => ({
      id: row.id,
      name: row.pool_name,
      lockDays: row.lock_days,
      aprRate: parseFloat(row.apr_rate),
      earlyPenaltyRate: parseFloat(row.early_penalty_rate),
      minStake: parseFloat(row.min_stake),
      maxStake: row.max_stake ? parseFloat(row.max_stake) : undefined,
      totalStaked: parseFloat(row.current_total_staked),
      activeStakes: parseInt(row.active_stakes_count),
      isActive: row.is_active
    }));
  }

  /**
   * Estimate rewards for a potential stake
   */
  async estimateRewards(amount: number, aprRate: number, days: number) {
    const validation = validateStakeAmount(amount);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    const estimatedRewards = calculateRewards(amount, aprRate, days);
    const dailyReward = calculateRewards(amount, aprRate, 1);
    
    return {
      stakeAmount: amount,
      aprRate,
      days,
      estimatedRewards,
      dailyReward,
      totalReturn: amount + estimatedRewards,
      roi: (estimatedRewards / amount) * 100
    };
  }

  /**
   * Map database row to UserStake type
   */
  private mapToUserStake(row: any): UserStake {
    return {
      id: row.id,
      userId: row.user_id,
      poolId: row.pool_id,
      stakeAmount: parseFloat(row.stake_amount),
      rewardAmount: parseFloat(row.reward_amount || 0),
      stakeDate: new Date(row.stake_date),
      unlockDate: new Date(row.unlock_date),
      unstakeDate: row.unstake_date ? new Date(row.unstake_date) : undefined,
      status: row.status as StakeStatus,
      txHashStake: row.tx_hash_stake,
      txHashUnstake: row.tx_hash_unstake,
      penaltyAmount: row.penalty_amount ? parseFloat(row.penalty_amount) : undefined
    };
  }

  /**
   * Emit staking events
   */
  private emitStakingEvent(
    action: StakingEvent['action'], 
    payload: StakingEvent['payload']
  ) {
    const event: StakingEvent = {
      module: 'staking',
      action,
      payload,
      timestamp: new Date().toISOString(),
      userId: payload.userId
    };
    
    this.eventEmitter.emit(action, event);
  }
}
