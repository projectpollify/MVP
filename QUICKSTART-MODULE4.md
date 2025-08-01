# Module 4 Quick Start Guide

## Prerequisites
- Node.js 18+
- PostgreSQL running
- Modules 1-3 already set up

## Step-by-Step Setup

### 1. Update Dependencies
```bash
# Install new packages
npm install @meshsdk/core @meshsdk/react jsonwebtoken @types/jsonwebtoken

# Or if using the complete package.json:
npm install
```

### 2. Database Updates
```bash
# Run the migration
psql -U pollify_user -d pollify_db -f src/database/migrations/004_blockchain_tokens.sql

# Run the seed data
psql -U pollify_user -d pollify_db -f src/database/seeds/004_supported_tokens.sql

# Update Prisma schema
npx prisma db pull
npx prisma generate
```

### 3. Environment Setup
```bash
# Copy and update .env
cp .env.example .env

# Add these required values:
BLOCKFROST_API_KEY=preprodXXXXXXXXXXXXXXXXXXXXXXXXXXXX
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars
CARDANO_NETWORK=preprod
```

### 4. Get Blockfrost API Key
1. Go to https://blockfrost.io
2. Sign up for free account
3. Create new project → Select "Cardano" → Select "Preprod Testnet"
4. Copy the API key to your `.env`

### 5. File Structure
Create these files in your GitHub repo:
```
src/
├── modules/
│   ├── blockchain/
│   │   ├── interfaces/
│   │   │   └── blockchain.interface.ts
│   │   ├── services/
│   │   │   ├── cardano.service.ts
│   │   │   ├── record.service.ts
│   │   │   └── faucet.service.ts
│   │   ├── tokens/
│   │   │   └── token.registry.ts
│   │   ├── blockchain.routes.ts
│   │   ├── blockchain.manager.ts
│   │   ├── index.ts
│   │   └── README.md
│   └── auth/
│       ├── wallet.auth.ts (NEW)
│       └── auth.routes.ts (UPDATED)
├── database/
│   ├── migrations/
│   │   └── 004_blockchain_tokens.sql (NEW)
│   └── seeds/
│       └── 004_supported_tokens.sql (NEW)
└── index.ts (UPDATED)
```

### 6. Start the Server
```bash
npm run dev
```

You should see:
```
🚀 Pollify MVP Server Running
📍 Port: 3000
🌍 Environment: development
🔗 Blockchain: preprod
```

## Testing the Integration

### 1. Check Available Tokens
```bash
curl http://localhost:3000/api/v1/blockchain/tokens
```

### 2. Test Wallet Authentication
```bash
# Get nonce
curl http://localhost:3000/api/v1/auth/nonce/addr_test1qz...

# In real app, wallet would sign the nonce
# Then verify signature to get JWT token
```

### 3. Check Token Balance
```bash
curl http://localhost:3000/api/v1/blockchain/balance/addr_test1qz...?token=PCO
```

## Common Issues

### "Cannot find module '@meshsdk/core'"
→ Run `npm install @meshsdk/core @meshsdk/react`

### "relation 'supported_tokens' does not exist"
→ Run the migration: `psql -U pollify_user -d pollify_db -f src/database/migrations/004_blockchain_tokens.sql`

### "Invalid Blockfrost API key"
→ Make sure you're using a Preprod testnet key, not Mainnet

## Next Steps

1. **Frontend Integration**
   - Install Lace wallet extension
   - Create wallet connection UI
   - Implement authentication flow

2. **Token Testing**
   - Use faucet endpoint to get test tokens
   - Test transfer functionality
   - Create immutable records

3. **Production Preparation**
   - Mint actual tokens on testnet
   - Update policy IDs
   - Implement proper wallet signing

## Support
- Blockfrost Docs: https://docs.blockfrost.io
- Mesh SDK Docs: https://meshjs.dev
- Cardano Developer Portal: https://developers.cardano.org
