// Moderation module configuration
export const moderationConfig = {
  // Badge assignment settings
  badge: {
    defaultRatio: 50, // 1 badge per X active users
    minDutyDays: 3,
    maxDutyDays: 7,
    invitationTimeoutHours: 12,
    minActionsRequired: 5,
  },

  // Eligibility requirements
  eligibility: {
    minReputation: 0,
    minAccountAgeDays: 7,
    maxInactivityDays: 30,
    cooldownDays: 14, // Days before user can hold another badge
  },

  // Rewards configuration
  rewards: {
    completionPCO: 0.5,
    completionReputation: 5,
    abandonmentPenalty: -3,
    // Milestone rewards
    milestones: {
      veteranModerator: { badges: 10, pco: 5, reputation: 20 },
      centurion: { actions: 100, pco: 3, reputation: 15 },
      pillarGuardian: { pillarBadges: 1, pco: 2, reputation: 10 },
    }
  },

  // Auto-moderation thresholds
  autoModeration: {
    autoHideThreshold: 5, // Flags before auto-hide
    criticalFlagThreshold: 10, // Flags for immediate escalation
  },

  // Performance settings
  performance: {
    maxBatchReviewSize: 20,
    queuePageSize: 50,
    statsRetentionDays: 90,
    archiveAfterDays: 90,
  },

  // Cron job timings (in cron format)
  cronJobs: {
    badgeBalance: '0 * * * *', // Every hour
    invitationTimeouts: '30 * * * *', // Every hour at :30
    badgeExpiration: '15 * * * *', // Every hour at :15
    dailyPerformance: '0 2 * * *', // 2 AM daily
    statsUpdate: '0 3 * * *', // 3 AM daily
    cleanup: '0 */6 * * *', // Every 6 hours
  },

  // Feature flags
  features: {
    enableBadgeTrading: false, // Future feature
    enableAppeals: false, // Future feature
    enableSpecializedBadges: false, // Future feature
    enableNFTCertificates: false, // Future feature
  }
};

// Environment variables required for the module
export const requiredEnvVars = [
  'SYSTEM_WALLET_ADDRESS', // For PCO token transfers
  'DATABASE_URL', // PostgreSQL connection
  'BLOCKFROST_API_KEY', // For blockchain operations
  'CARDANO_NETWORK', // mainnet or testnet
];

// Validate environment configuration
export function validateEnvironment(): void {
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for moderation module: ${missing.join(', ')}`
    );
  }
}

// Get configuration value with environment override
export function getConfig(path: string, defaultValue?: any): any {
  // Convert path to environment variable name
  // e.g., 'badge.defaultRatio' -> 'MOD_BADGE_DEFAULT_RATIO'
  const envVar = 'MOD_' + path.toUpperCase().replace(/\./g, '_');
  
  if (process.env[envVar]) {
    const value = process.env[envVar];
    // Try to parse as number or boolean if applicable
    if (!isNaN(Number(value))) {
      return Number(value);
    }
    if (value === 'true' || value === 'false') {
      return value === 'true';
    }
    return value;
  }
  
  // Get value from config object
  const keys = path.split('.');
  let value: any = moderationConfig;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }
  
  return value !== undefined ? value : defaultValue;
}
