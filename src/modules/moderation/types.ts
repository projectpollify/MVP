// Type definitions for Module 7: Community Moderation System

export type BadgeStatus = 'offered' | 'active' | 'expired' | 'declined' | 'abandoned';
export type ScopeType = 'group' | 'pillar';
export type ModerationAction = 'keep' | 'remove';
export type ContentType = 'post' | 'comment';
export type InvitationResponse = 'accepted' | 'declined' | 'timeout';

export interface ModerationBadge {
  id: string;
  scopeType: ScopeType;
  scopeId: string;
  scopeName?: string;
  holderId: string;
  holderName?: string;
  status: BadgeStatus;
  dutyDays: number;
  startDate?: Date;
  endDate?: Date;
  offeredAt: Date;
  acceptedAt?: Date;
  actionsTaken: number;
  minActionsRequired: number;
  blockchainTxHash?: string;
  progress?: number;
  timeRemaining?: string;
}

export interface BadgeInvitation {
  id: string;
  badgeId: string;
  userId: string;
  scopeType: ScopeType;
  scopeId: string;
  scopeName?: string;
  dutyDays: number;
  invitedAt: Date;
  expiresAt: Date;
  response?: InvitationResponse;
  respondedAt?: Date;
}

export interface ModerationActionRecord {
  id: string;
  badgeId: string;
  contentType: ContentType;
  contentId: string;
  action: ModerationAction;
  reason?: string;
  flagsAtReview: number;
  blockchainTxHash?: string;
  createdAt: Date;
}

export interface FlaggedContent {
  contentType: ContentType;
  contentId: string;
  contentText: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
  flagCount: number;
  flagReasons: string[];
  groupId?: string;
  groupName?: string;
  alreadyHidden: boolean;
  previousActions: ModerationActionRecord[];
}

export interface ModerationDecisionRequest {
  badgeId: string;
  contentType: ContentType;
  contentId: string;
  action: ModerationAction;
  reason?: string;
}

export interface BatchModerationRequest {
  badgeId: string;
  decisions: Array<{
    contentType: ContentType;
    contentId: string;
    action: ModerationAction;
    reason?: string;
  }>;
}

export interface ModerationStats {
  scopeType: ScopeType;
  scopeId: string;
  activeBadges: number;
  completedBadges: number;
  totalActions30d: number;
  removals30d: number;
  keeps30d: number;
  avgActionsPerBadge: number;
  uniqueModerators30d: number;
  pendingFlags: number;
  removalRate?: number;
  avgResponseTimeHours?: number;
}

export interface ModeratorLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  walletPubKey: string;
  badgesCompleted: number;
  totalActions: number;
  avgActionsPerBadge: number;
  successfulCompletions: number;
  lastBadgeCompleted: Date;
}

export interface BadgePerformanceMetrics {
  badgeId: string;
  scopeType: ScopeType;
  scopeId: string;
  holderId: string;
  totalActions: number;
  keeps: number;
  removes: number;
  avgHoursToAction: number;
  actionsPerDay: number;
  hoursActive: number;
  performanceStatus: 'completed' | 'in_progress' | 'abandoned';
  rewardPco?: number;
  rewardReputation?: number;
}

export interface ModerationConfig {
  id: number;
  scopeType: ScopeType;
  scopeId: string;
  badgeRatio: number;
  minReputation: number;
  minAccountAgeDays: number;
  rewardPco: number;
  rewardReputation: number;
  penaltyReputation: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EligibilityCheck {
  eligible: boolean;
  reasons: string[];
  userId?: string;
  currentBadge?: ModerationBadge;
  cooldownEndsAt?: Date;
}

export interface ModerationQueueResponse {
  badge: ModerationBadge;
  queue: FlaggedContent[];
  totalItems: number;
  reviewedToday: number;
}

export interface ModerationEvent {
  type: 
    | 'badge:offered'
    | 'badge:accepted'
    | 'badge:declined'
    | 'badge:expired'
    | 'badge:abandoned'
    | 'badge:passed'
    | 'badge:timeout'
    | 'moderation:content_removed'
    | 'moderation:content_kept'
    | 'moderation:reward_distributed';
  timestamp: Date;
  data: Record<string, any>;
}

export interface BadgeMilestone {
  type: 'veteran_moderator' | 'centurion' | 'pillar_guardian';
  description: string;
  achieved: boolean;
  progress: number;
  target: number;
  reward: {
    pco: number;
    reputation: number;
  };
}

export interface UserModerationProfile {
  userId: string;
  isEligible: boolean;
  currentBadge?: ModerationBadge;
  pendingInvitations: BadgeInvitation[];
  history: {
    totalBadges: number;
    completedBadges: number;
    totalActions: number;
    avgActionsPerBadge: number;
    totalPcoEarned: number;
    totalReputationEarned: number;
    lastBadgeDate?: Date;
  };
  milestones: BadgeMilestone[];
  nextEligibleDate?: Date;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    timestamp: Date;
    version: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Notification types
export interface ModerationNotification {
  id: string;
  type: 'badge_invitation' | 'badge_expiring' | 'milestone_achieved' | 'queue_update';
  userId: string;
  title: string;
  message: string;
  actionUrl?: string;
  priority: 'low' | 'medium' | 'high';
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
  data?: Record<string, any>;
}
