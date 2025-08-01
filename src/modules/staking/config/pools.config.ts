/**
 * Staking Pool Configuration
 * Defines the 5 fixed-duration pools with their respective APR and penalty rates
 */

export interface StakingPool {
  id: number;
  name: string;
  lockDays: number;
  aprRate: number;      // Annual Percentage Rate (e.g., 3.0 = 3%)
  earlyPenaltyRate: number; // Penalty percentage (e.g., 50.0 = 50%)
  minStake: number;     // Minimum stake in PCO
  maxStake?: number;    // Optional maximum stake
  isActive: boolean;
}

export const STAKING_POOLS: StakingPool[] = [
  {
    id: 1,
    name: '7 Day Pool',
    lockDays: 7,
    aprRate: 3.0,
    earlyPenaltyRate: 50.0,
    minStake: 10,
    isActive: true
  },
  {
    id: 2,
    name: '30 Day Pool',
    lockDays: 30,
    aprRate: 4.0,
    earlyPenaltyRate: 60.0,
    minStake: 10,
    isActive: true
  },
  {
    id: 3,
    name: '90 Day Pool',
    lockDays: 90,
    aprRate: 5.0,
    earlyPenaltyRate: 70.0,
    minStake: 10,
    isActive: true
  },
  {
    id: 4,
    name: '180 Day Pool',
    lockDays: 180,
    aprRate: 6.0,
    earlyPenaltyRate: 80.0,
    minStake: 10,
    isActive: true
  },
  {
    id: 5,
    name: '365 Day Pool',
    lockDays: 365,
    aprRate: 7.0,
    earlyPenaltyRate: 90.0,
    minStake: 10,
    isActive: true
  }
];

// Constants for staking operations
export const STAKING_CONSTANTS = {
  PCO_DECIMALS: 6,
  SECONDS_PER_DAY: 86400,
  DAYS_PER_YEAR: 365,
  MIN_STAKE_AMOUNT: 10, // 10 PCO minimum
  STAKE_MULTIPLE: 1,    // Stakes must be multiples of 1 PCO
  NULL_ADDRESS: 'addr1w8phkx6acpnf78fuvxn0mkew3l0fd058hzquvz7w36x4gtcyjy7wx' // Cardano null address for burning
};

/**
 * Calculate the unlock date for a stake
 */
export function calculateUnlockDate(lockDays: number): Date {
  const unlockDate = new Date();
  unlockDate.setDate(unlockDate.getDate() + lockDays);
  return unlockDate;
}

/**
 * Check if a stake amount is valid
 */
export function isValidStakeAmount(amount: number): boolean {
  return amount >= STAKING_CONSTANTS.MIN_STAKE_AMOUNT && 
         amount % STAKING_CONSTANTS.STAKE_MULTIPLE === 0;
}
