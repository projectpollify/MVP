# Developer Quick Start Guide

## Prerequisites
- Node.js 18+ installed
- PostgreSQL 14+ running
- Git installed
- Blockfrost account (free tier is fine)

## Initial Setup (10 minutes)

### 1. Clone the Repository
```bash
git clone [repository-url]
cd pollify-net
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
```bash
# Copy the example file
cp .env.example .env

# Edit .env with your values:
# - DATABASE_URL from your PostgreSQL
# - JWT_SECRET (generate a random string)
# - BLOCKFROST_PROJECT_ID from blockfrost.io
```

### 4. Set Up Database
```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Open Prisma Studio to view database
npm run db:studio
```

### 5. Start Development Server
```bash
npm run dev
```

Server should start on http://localhost:3000

## Your First Task: Implement Module 2

### Step 1: Review the Specifications
Read `/docs/module-2-auth-specs.md` completely. This has all the details you need.

### Step 2: Implement in This Order

1. **Database Setup** ✅ (Already done via Prisma)

2. **Auth Service** (`src/services/auth.service.ts`)
   - Nonce generation
   - Signature verification
   - User creation
   - JWT token generation

3. **Auth Middleware** (`src/middleware/auth.middleware.ts`)
   - Token verification
   - User attachment to request
   - Mode checking

4. **Auth Controller** (`src/controllers/auth.controller.ts`)
   - Handle HTTP requests
   - Call auth service
   - Return responses

5. **Update Routes** (`src/routes/auth.routes.ts`)
   - Wire up controllers
   - Add middleware
   - Add rate limiting

### Step 3: Testing Your Implementation

Test the auth flow:
```bash
# 1. Get a nonce
curl -X POST http://localhost:3000/api/v1/auth/nonce \
  -H "Content-Type: application/json" \
  -d '{"wallet_address": "addr1..."}'

# 2. Sign with wallet (frontend will do this)

# 3. Verify signature
curl -X POST http://localhost:3000/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "addr1...",
    "signature": "...",
    "key": "...",
    "nonce": "..."
  }'

# 4. Use the returned JWT token
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer {token}"
```

## Important Implementation Notes

### Cardano Signature Verification
Use the `@emurgo/cardano-serialization-lib-nodejs` library:
```typescript
import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';

const publicKey = CSL.PublicKey.from_hex(key);
const ed25519Signature = CSL.Ed25519Signature.from_hex(signature);
const message = Buffer.from(nonce, 'utf8');
const isValid = publicKey.verify(message, ed25519Signature);
```

### JWT Token Management
```typescript
import jwt from 'jsonwebtoken';

// Sign token
const token = jwt.sign(payload, process.env.JWT_SECRET, {
  expiresIn: '24h'
});

// Verify token
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

### Mode-Based Permissions
```typescript
// In middleware
if (req.user.mode === 'soul') {
  // Read-only access
}
```

## Common Issues & Solutions

### Issue: Cannot connect to database
**Solution**: Check DATABASE_URL in .env, ensure PostgreSQL is running

### Issue: Cardano library errors
**Solution**: Make sure you're using Node.js 18+

### Issue: CORS errors from frontend
**Solution**: Update FRONTEND_URL in .env

## Need Help?

1. Check the specifications again
2. Look at error messages carefully
3. Verify your environment setup
4. Ask specific questions with error logs

## Next Steps After Module 2

Once authentication is working:
1. Create integration tests
2. Document any deviations from spec
3. Prepare for Module 3 (Groups & Posts)
