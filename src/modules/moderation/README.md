# Module 7: Community Moderation System

## Overview
Module 7 implements Pollify's innovative rotating badge moderation system where community members temporarily become moderators for 3-7 day periods.

## Key Features
- 🎯 **Automatic Badge Assignment** - Randomly selects eligible users based on activity
- 🛡️ **Temporary Moderator Badges** - 3-7 day duty periods with clear expectations  
- 💰 **PCO Token Rewards** - 0.5 PCO + 5 reputation for completing duty
- 📊 **Transparent Moderation** - All actions recorded on blockchain
- 🔄 **Self-Scaling System** - More users = more badges automatically

## How It Works

1. **Badge Creation**
   - System calculates needed badges (1 per 50 active users)
   - Randomly selects eligible user
   - Sends 12-hour invitation

2. **Badge Acceptance**
   - User accepts/declines within 12 hours
   - If declined/timeout, moves to next user
   - Badge holder gets shield icon on avatar

3. **Moderation Duty**
   - Review flagged content in private queue
   - Make keep/remove decisions
   - Complete minimum 5 actions

4. **Completion & Rewards**
   - Automatic PCO transfer on completion
   - Reputation boost (+5)
   - 14-day cooldown before next badge

## API Endpoints

### User Endpoints
- `GET /api/v1/moderation/eligibility` - Check if eligible
- `GET /api/v1/moderation/invitations` - View pending invites
- `POST /api/v1/moderation/accept/:id` - Accept badge
- `POST /api/v1/moderation/decline/:id` - Decline badge
- `GET /api/v1/moderation/my-badge` - Current badge status

### Badge Holder Endpoints  
- `GET /api/v1/moderation/queue` - View flagged content
- `POST /api/v1/moderation/review` - Submit decision
- `POST /api/v1/moderation/pass-badge` - Emergency pass

### Public Endpoints
- `GET /api/v1/moderation/stats/:scope/:id` - View stats
- `GET /api/v1/moderation/leaderboard` - Top moderators

## Database Tables

- `mod_badges` - Badge assignments and status
- `mod_actions` - Moderation decisions log
- `badge_invitations` - Invitation tracking
- `badge_history` - Completion history
- `moderation_config` - Per-scope settings

## Configuration

### Environment Variables
```env
SYSTEM_WALLET_ADDRESS=addr1_xxxxx  # Required for PCO transfers
MOD_BADGE_DEFAULT_RATIO=50         # Users per badge
MOD_REWARDS_COMPLETION_PCO=0.5     # PCO reward amount
