# Module 4: Blockchain & Cardano Integration

This module provides blockchain functionality for Pollify, including token management, immutable records, and wallet authentication.

## Features

### 1. **Dual-Token System**
- **Poll Coin (PCO)**: Governance token with 6 decimals
- **Gratium**: Appreciation token with 0 decimals (non-divisible)
- Future-ready for additional tokens (Cosmoflux, Thought)

### 2. **Wallet Authentication**
- Cardano wallet integration (Lace wallet for MVP)
- Signature-based authentication
- JWT token generation

### 3. **Immutable Records**
- Store vital platform data on-chain
- Support for multiple record types:
  - Poll results
  - Moderation decisions
  - Reputation changes
  - Source verifications
  - Governance decisions

### 4. **Testnet Faucet**
- Distribute test tokens
- 100 PCO per claim
- 100 Gratium per claim
- 24-hour cooldown period

## Setup Instructions

### 1. Install Dependencies
```bash
npm install @meshsdk/core @meshsdk/react jsonwebtoken @types/jsonwebtoken
```

### 2. Run Database Migrations
```bash
# Run the new migration
psql -d pollify_db -f src/database/migrations/004_blockchain_tokens.sql

# Seed token data
psql -d pollify_db -f src/database/seeds/004_supported_tokens.sql

# Update Prisma
npx prisma db pull
npx prisma generate
```

### 3. Configure Environment
Copy the updated `.env.example` and set:
- `BLOCKFROST_API_KEY`: Get from https://blockfrost.io
- `JWT_SECRET`: Generate a secure random string
- `CARDANO_NETWORK`: Use `preprod` for testing

### 4. Get Blockfrost API Key
1. Visit https://blockfrost.io
2. Create a free account
3. Create a new project for Cardano Preprod
4. Copy the API key to your `.env` file

## API Endpoints

### Authentication
- `GET /api/v1/auth/nonce/:address` - Get nonce for wallet signing
- `POST /api/v1/auth/verify` - Verify signature and get JWT
- `GET /api/v1/auth/me` - Get current user info

### Blockchain Operations
- `GET /api/v1/blockchain/tokens` - List supported tokens
- `GET /api/v1/blockchain/balance/:address` - Get token balances
- `POST /api/v1/blockchain/transfer` - Transfer tokens (authenticated)
- `POST /api/v1/blockchain/record` - Create immutable record (authenticated)
- `GET /api/v1/blockchain/record/:txHash` - Get record by transaction hash

### Faucet
- `POST /api/v1/blockchain/faucet/claim` - Claim test tokens (authenticated)
- `GET /api/v1/blockchain/faucet/status/:address` - Check claim eligibility

## Usage Examples

### 1. Wallet Authentication Flow
```javascript
// Frontend example
// Step 1: Get nonce
const nonceResponse = await fetch(`/api/v1/auth/nonce/${walletAddress}`);
const { data } = await nonceResponse.json();

// Step 2: Sign message with wallet
const signature = await wallet.signData(walletAddress, data.message);

// Step 3: Verify signature
const authResponse = await fetch('/api/v1/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: walletAddress,
    signature,
    nonce: data.nonce
  })
});
const { data: authData } = await authResponse.json();
const token = authData.token; // Store this JWT
```

### 2. Check Token Balance
```javascript
const response = await fetch(`/api/v1/blockchain/balance/${walletAddress}?token=PCO`);
const { data } = await response.json();
console.log('PCO Balance:', data.balances[0].formatted);
```

### 3. Claim from Faucet
```javascript
const response = await fetch('/api/v1/blockchain/faucet/claim', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ token: 'PCO' })
});
const { data } = await response.json();
console.log('Claimed:', data.claim.formattedAmount);
```

### 4. Create Immutable Record
```javascript
const response = await fetch('/api/v1/blockchain/record', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'poll_result',
    data: {
      pollId: 'poll123',
      results: { option1: 45, option2: 55 },
      totalVotes: 100
    }
  })
});
const { data } = await response.json();
console.log('Record TX:', data.record.txHash);
```

## Architecture

### Modular Design
```
blockchain/
├── interfaces/          # TypeScript interfaces
├── services/           # Blockchain implementations
│   ├── cardano.service.ts
│   ├── record.service.ts
│   └── faucet.service.ts
├── tokens/             # Token registry
└── blockchain.routes.ts # API endpoints
```

### Future Multi-Chain Support
The architecture supports adding new blockchains:
1. Implement `IBlockchainService` interface
2. Register in `BlockchainManager`
3. Add chain-specific configuration

## Token Minting (Future Task)

To mint actual tokens on Cardano:
1. Write Plutus/Aiken smart contracts
2. Define minting policies
3. Submit minting transaction
4. Update policy IDs in `.env`

For MVP, we're using test policy IDs.

## Security Considerations

1. **Wallet Authentication**
   - Nonces expire after 5 minutes
   - Each nonce can only be used once
   - Signatures are verified on backend

2. **Token Operations**
   - All transfers require authentication
   - Amounts are validated and parsed safely
   - Transaction history is recorded

3. **Immutable Records**
   - Data is hashed before storing
   - Hashes are verified on retrieval
   - Records cannot be modified

## Testing

### Manual Testing
1. Connect to Preprod testnet
2. Use Lace wallet (or any Cardano wallet)
3. Claim test tokens from faucet
4. Test token transfers
5. Create and verify records

### Unit Tests (TODO)
- Token registry tests
- Service mocking
- API endpoint tests

## Next Steps

1. **Smart Contract Development**
   - Write token minting contracts
   - Implement governance features
   - Add staking mechanisms

2. **Frontend Integration**
   - Wallet connection UI
   - Token balance display
   - Transaction history

3. **Multi-Chain Expansion**
   - Add Tron for NFTs
   - Implement bridge contracts
   - Cross-chain messaging
