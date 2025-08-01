# Module 6: Staking System Integration Guide

## Overview
Module 6 implements PCO token staking with 5 fixed-duration pools, allowing users to lock tokens and earn rewards based on APR rates.

## Features
- 5 staking pools (7, 30, 90, 180, 365 days)
- Fixed APR rates (3% - 7%)
- Early exit penalties (50% - 90% on rewards only)
- Real-time reward calculation
- Blockchain integration for immutable records
- Comprehensive statistics and analytics

## Integration Steps

### 1. Add Module to Main Application

In `src/app.ts`:
```typescript
import { StakingModule } from './modules/staking';

// After initializing other modules
const stakingModule = new StakingModule(db, eventEmitter, blockchainModule);
await stakingModule.initialize();

// Add routes
app.use('/api/v1/staking', stakingModule.getRouter());
```

### 2. Update Token Service (Module 4)

Add these methods to `src/modules/blockchain/services/token.service.ts`:

```typescript
async transferToStakingContract(
  fromAddress: string, 
  amount: number, 
  lockDays: number
): Promise<{ txHash: string }> {
  // Implementation to transfer PCO to staking contract
  const tx = await this.meshWallet.sendLovelace(
    STAKING_CONTRACT_ADDRESS,
    toMicroPCO(amount)
  );
  return { txHash: tx.txHash };
}

async unstakeNormal(
  stakeId: string,
  principal: number,
  rewards: number
): Promise<{ txHash: string }> {
  // Mint rewards and return principal + rewards
  await this.mintPCO(rewards);
  // Transfer back to user
  return { txHash: 'tx_hash' };
}

async unstakeEarly(
  stakeId: string,
  principal: number,
  netRewards: number,
  penalty: number
): Promise<{ txHash: string }> {
  // Mint net rewards, burn penalty
  await this.mintPCO(netRewards);
  await this.burnPCO(penalty);
  // Transfer back to user
  return { txHash: 'tx_hash' };
}
```

### 3. Environment Variables

Add to `.env`:
```
STAKING_CONTRACT_ADDRESS=addr1_staking_contract_here
STAKING_BURN_ADDRESS=addr1w8phkx6acpnf78fuvxn0mkew3l0fd058hzquvz7w36x4gtcyjy7wx
```

### 4. Database Setup

Run the migration:
```bash
psql -U your_user -d pollify_db -f src/modules/staking/database/migrations/001_create_staking_tables.sql
```

### 5. Frontend Integration

#### Staking Dashboard Component
```typescript
// List pools
const response = await fetch('/api/v1/staking/pools');
const pools = await response.json();

// Create stake
const stakeResponse = await fetch('/api/v1/staking/stake', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${walletSignature}`
  },
  body: JSON.stringify({
    poolId: 1,
    amount: 100 // 100 PCO
  })
});

// View my stakes
const myStakes = await fetch('/api/v1/staking/my-stakes');

// Calculate current rewards
const rewards = await fetch(`/api/v1/staking/calculate/${stakeId}`);

// Unstake
const unstakeResponse = await fetch(`/api/v1/staking/unstake/${stakeId}`, {
  method: 'POST',
  body: JSON.stringify({
    isEarlyExit: false
  })
});
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/staking/pools` | List all staking pools |
| GET | `/api/v1/staking/my-stakes` | Get user's stakes |
| POST | `/api/v1/staking/stake` | Create new stake |
| POST | `/api/v1/staking/unstake/:id` | Unstake (normal/early) |
| GET | `/api/v1/staking/calculate/:id` | Calculate current rewards |
| GET | `/api/v1/staking/stats` | Platform statistics |
| GET | `/api/v1/staking/estimate` | Estimate potential rewards |

## Event Integration

Module 6 emits these events:
- `stake:created` - New stake created
- `stake:completed` - Normal unstake completed
- `stake:early_exit` - Early unstake with penalty
- `rewards:calculated` - Rewards calculated
- `rewards:minted` - Rewards minted on-chain

## Smart Contract Deployment

1. Install Aiken CLI:
```bash
curl -sSfL https://install.aiken-lang.org | bash
```

2. Build the contract:
```bash
cd src/modules/staking/contracts
aiken build
```

3. Deploy to Cardano testnet/mainnet using your preferred method

## Governance Integration (Future)

Staked PCO will provide increased voting power:
```typescript
// In governance module
const votingPower = baseVotes + (stakedAmount * STAKE_MULTIPLIER);

// Longer stakes = higher multiplier
const multiplier = getMultiplierByDays(lockDays);
```

## Testing

Run module tests:
```bash
npm test -- --testPathPattern=staking
```

## Security Considerations

1. **Rate Limiting**: Stake/unstake operations are rate-limited to prevent spam
2. **Balance Validation**: Always verify user has sufficient balance before staking
3. **Time Validation**: Use blockchain time for unlock date verification
4. **Decimal Precision**: All amounts use 6 decimal places (PCO standard)
5. **Reentrancy Protection**: Database transactions prevent double-spending

## Monitoring

Key metrics to monitor:
- Total Value Locked (TVL)
- Active stakes count
- Average stake duration
- Reward distribution rate
- Early exit rate
- Pool utilization

## Common Issues

1. **"Already have active stake in pool"**: Users can only have one active stake per pool
2. **"Insufficient balance"**: Check user has enough PCO including fees
3. **"Invalid stake amount"**: Must be >= 10 PCO and whole numbers only
4. **Transaction failures**: Check Cardano network status and contract funding
