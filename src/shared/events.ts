import { EventEmitter } from 'events';

// Create the event emitter instance
const eventEmitter = new EventEmitter();

// Set max listeners to prevent warnings
eventEmitter.setMaxListeners(30);

// Export the event emitter for direct access
export { eventEmitter };

// Helper function to emit events with logging
export async function emitEvent(event: string, data: any) {
    console.log(`Event emitted: ${event}`, data);
    eventEmitter.emit(event, data);
    
    // Store in database for other modules
    // This is a stub - implement based on your event storage strategy
}

// Helper function to listen to events
export function onEvent(event: string, handler: (data: any) => void) {
    eventEmitter.on(event, handler);
}

// Helper function to listen to events once
export function onceEvent(event: string, handler: (data: any) => void) {
    eventEmitter.once(event, handler);
}

// Helper function to remove event listeners
export function offEvent(event: string, handler: (data: any) => void) {
    eventEmitter.off(event, handler);
}

// Helper function to remove all listeners for an event
export function removeAllListeners(event?: string) {
    if (event) {
        eventEmitter.removeAllListeners(event);
    } else {
        eventEmitter.removeAllListeners();
    }
}

// Export event types for type safety
export type EventHandler = (data: any) => void;

// Common event names used across modules
export const EventNames = {
    // Auth events
    USER_CREATED: 'user:created',
    USER_LOGIN: 'user:login',
    USER_LOGOUT: 'user:logout',
    
    // Group events
    GROUP_CREATED: 'group:created',
    GROUP_UPDATED: 'group:updated',
    GROUP_DELETED: 'group:deleted',
    GROUP_MEMBER_JOINED: 'group:member_joined',
    GROUP_MEMBER_LEFT: 'group:member_left',
    
    // Post events
    POST_CREATED: 'post:created',
    POST_UPDATED: 'post:updated',
    POST_DELETED: 'post:deleted',
    
    // Flag events
    CONTENT_FLAGGED: 'content:flagged',
    FLAG_RESOLVED: 'flag:resolved',
    
    // Badge events
    BADGE_OFFERED: 'badge:offered',
    BADGE_ACCEPTED: 'badge:accepted',
    BADGE_DECLINED: 'badge:declined',
    BADGE_EXPIRED: 'badge:expired',
    BADGE_ABANDONED: 'badge:abandoned',
    BADGE_PASSED: 'badge:passed',
    BADGE_TIMEOUT: 'badge:timeout',
    
    // Moderation events
    MODERATION_CONTENT_REMOVED: 'moderation:content_removed',
    MODERATION_CONTENT_KEPT: 'moderation:content_kept',
    MODERATION_REWARD_DISTRIBUTED: 'moderation:reward_distributed',
    
    // Reputation events
    USER_REPUTATION_CHANGED: 'user:reputation_changed',
    
    // Notification events
    NOTIFICATION_SEND: 'notification:send',
    
    // Blockchain events
    BLOCKCHAIN_RECORD_CREATED: 'blockchain:record_created',
    TOKEN_TRANSFERRED: 'token:transferred',
    
    // Staking events
    STAKE_CREATED: 'stake:created',
    STAKE_RELEASED: 'stake:released',
    STAKE_SLASHED: 'stake:slashed'
} as const;
