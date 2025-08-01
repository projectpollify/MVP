/**
 * Staking Reward Calculation Utilities
 * Core mathematical functions for reward and penalty calculations
 */

import { STAKING_CONSTANTS } from '../config/pools.config';
import { RewardCalculation } from '../types/staking.types';

/**
 * Calculate the number of days between two dates
 */
export function calculateDaysBetween(startDate: Date, endDate: Date): number {
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.floor(diffMs / (STAKING_CONSTANTS.SECONDS_PER_DAY * 1000));
}

/**
 * Calculate staking rewards based on APR
 * Formula: reward = principal × (APR / 365) × days
 */
export function calculateRewards(
  principal: number,
  aprRate: number,
  daysStaked: number
): number {
  const dailyRate = aprRate / 100 / STAKING_CONSTANTS.DAYS_PER_YEAR;
  const reward = principal * dailyRate * daysStaked;
  
  // Round to 6 decimal places (PCO decimals)
  return Math.floor(reward * 1000000) / 1000000;
}

/**
 * Calculate early exit penalty
 * Penalty is applied to rewards only, not principal
 */
export function calculatePenalty(
  rewardAmount: number,
  penaltyRate: number
): number {
  const penalty = rewardAmount * (penaltyRate / 100);
  // Round to 6 decimal places
  return Math.floor(penalty * 1000000) / 1000000;
}

/**
 * Calculate complete reward details for a stake
 */
export function calculateStakeRewards(
  stakeId: string,
  stakeAmount: number,
  stakeDate: Date,
  aprRate: number,
  penaltyRate?: number,
  calculationDate: Date = new Date()
): RewardCalculation {
  const daysStaked = calculateDaysBetween(stakeDate, calculationDate);
  const currentReward = calculateRewards(stakeAmount, aprRate, daysStaked);
  const dailyRate = aprRate / 100 / STAKING_CONSTANTS.DAYS_PER_YEAR;
  
  let penaltyAmount = 0;
  let netReward = currentReward;
  
  // If early exit, calculate penalty
  if (penaltyRate !== undefined && penaltyRate > 0) {
    penaltyAmount = calculatePenalty(currentReward, penaltyRate);
    netReward = currentReward - penaltyAmount;
  }
  
  return {
    stakeId,
    currentReward,
    daysStaked,
    dailyRate,
    aprRate,
    penaltyAmount: penaltyAmount > 0 ? penaltyAmount : undefined,
    netReward
  };
}

/**
 * Validate stake amount meets requirements
 */
export function validateStakeAmount(amount: number): { valid: boolean; error?: string } {
  if (amount < STAKING_CONSTANTS.MIN_STAKE_AMOUNT) {
    return {
      valid: false,
      error: `Minimum stake amount is ${STAKING_CONSTANTS.MIN_STAKE_AMOUNT} PCO`
    };
  }
  
  if (amount % STAKING_CONSTANTS.STAKE_MULTIPLE !== 0) {
    return {
      valid: false,
      error: `Stake amount must be a multiple of ${STAKING_CONSTANTS.STAKE_MULTIPLE} PCO`
    };
  }
  
  return { valid: true };
}

/**
 * Format PCO amount for display (with 6 decimals)
 */
export function formatPCOAmount(amount: number): string {
  return amount.toFixed(6).replace(/\.?0+$/, '');
}

/**
 * Convert PCO to smallest unit (microPCO)
 */
export function toMicroPCO(amount: number): bigint {
  return BigInt(Math.floor(amount * Math.pow(10, STAKING_CONSTANTS.PCO_DECIMALS)));
}

/**
 * Convert from smallest unit (microPCO) to PCO
 */
export function fromMicroPCO(microAmount: bigint): number {
  return Number(microAmount) / Math.pow(10, STAKING_CONSTANTS.PCO_DECIMALS);
}

/**
 * Calculate estimated rewards for a future date
 */
export function estimateFutureRewards(
  principal: number,
  aprRate: number,
  targetDate: Date,
  startDate: Date = new Date()
): number {
  const daysToTarget = calculateDaysBetween(startDate, targetDate);
  return calculateRewards(principal, aprRate, daysToTarget);
}

/**
 * Calculate the effective APR after early exit penalty
 */
export function calculateEffectiveAPR(
  aprRate: number,
  penaltyRate: number,
  actualDays: number,
  plannedDays: number
): number {
  const normalReward = calculateRewards(100, aprRate, actualDays);
  const penalty = calculatePenalty(normalReward, penaltyRate);
  const netReward = normalReward - penalty;
  
  // Calculate what APR would give this net reward
  const effectiveAPR = (netReward * STAKING_CONSTANTS.DAYS_PER_YEAR) / (100 * actualDays) * 100;
  
  return Math.max(0, effectiveAPR); // Never negative
}
