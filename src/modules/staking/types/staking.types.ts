/**
 * TypeScript interfaces for the Staking Module
 */

export enum StakeStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  EARLY_EXIT = 'early_exit'
}

export interface UserStake {
  id: string;
  userId: string;
  poolId: number;
  stakeAmount: number;
  rewardAmount: number;
  stakeDate: Date;
  unlockDate: Date;
  unstakeDate?: Date;
  status: StakeStatus;
  txHashStake?: string;
  txHashUnstake?: string;
  penaltyAmount?: number;
}

export interface StakeRequest {
  poolId: number;
  amount: number;
  walletAddress: string;
}

export interface UnstakeRequest {
  stakeId: string;
  isEarlyExit: boolean;
}

export interface RewardCalculation {
  stakeId: string;
  currentReward: number;
  daysStaked: number;
  dailyRate: number;
  aprRate: number;
  penaltyAmount?: number;
  netReward: number;
}

export interface StakingStats {
  totalStaked: number;
  totalRewardsEarned: number;
  totalPenaltiesBurned: number;
  activeStakes: number;
  averageStakeDuration: number;
  poolDistribution: PoolStats[];
}

export interface PoolStats {
  poolId: number;
  poolName: string;
  totalStaked: number;
  activeStakes: number;
  aprRate: number;
}

export interface StakeTransaction {
  stakeId: string;
  txHash: string;
  blockNumber: number;
  timestamp: Date;
  amount: number;
  action: 'stake' | 'unstake' | 'reward_claim';
}

export interface StakingEvent {
  module: 'staking';
  action: 'stake:created' | 'stake:updated' | 'stake:completed' | 'stake:early_exit' | 'rewards:calculated' | 'rewards:minted';
  payload: {
    stakeId: string;
    userId: string;
    poolId?: number;
    amount?: number;
    rewards?: number;
    penalty?: number;
  };
  timestamp: string;
  userId: string;
}
