# Module 2: Authentication System Specifications

## Overview
Complete wallet-based authentication system for Pollify.net supporting three user modes: True Self, Alias/Shadow, and Soul.

## Authentication Flow

### 1. Wallet Connection Process
```mermaid
User clicks "Connect Wallet"
    ↓
Frontend checks for Lace wallet
    ↓
Frontend requests nonce from backend
    ↓
Backend generates & stores nonce
    ↓
User signs nonce with Lace wallet
    ↓
Frontend sends signature to backend
    ↓
Backend verifies signature
    ↓
Backend creates/retrieves user
    ↓
Backend returns JWT token
    ↓
User is authenticated
```

### 2. API Endpoints

#### Generate Nonce
```http
POST /api/v1/auth/nonce
Content-Type: application/json

{
  "wallet_address": "addr1..."
}

Response:
{
  "success": true,
  "data": {
    "nonce": "pollify-auth-1234567890-randomstring",
    "expires_at": "2024-01-01T12:00:00Z"
  }
}
```

#### Verify Signature & Login
```http
POST /api/v1/auth/verify
Content-Type: application/json

{
  "wallet_address": "addr1...",
  "signature": "...",
  "key": "...",
  "nonce": "pollify-auth-1234567890-randomstring"
}

Response:
{
  "success": true,
  "data": {
    "token": "jwt-token-here",
    "user": {
      "id": "uuid",
      "wallet_pub_key": "addr1...",
      "display_name": "@anon...abc123",
      "mode": "shadow",
      "pillar_id": null,
      "is_new_user": true
    }
  }
}
```

#### Get Current User
```http
GET /api/v1/auth/me
Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "wallet_pub_key": "addr1...",
      "display_name": "@anon...abc123",
      "mode": "shadow",
      "pillar_id": 1,
      "created_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

#### Update User Mode
```http
PUT /api/v1/auth/mode
Authorization: Bearer {token}
Content-Type: application/json

{
  "mode": "true" | "shadow" | "soul"
}

Response:
{
  "success": true,
  "data": {
    "token": "new-jwt-token",
    "mode": "true"
  }
}
```

#### Update Profile
```http
PUT /api/v1/users/{wallet_address}
Authorization: Bearer {token}
Content-Type: application/json

{
  "display_name": "NewName",
  "pillar_id": 3,
  "avatar_url": "https://..."
}

Response:
{
  "success": true,
  "data": {
    "user": { ... }
  }
}
```

### 3. User Modes

#### True Self Mode
- Verified identity visible
- Full reputation score displayed
- All features available
- 7-day session expiry

#### Alias/Shadow Mode (Default)
- Anonymous display name
- Actions tied to wallet
- Most features available
- 24-hour session expiry

#### Soul Mode
- Read-only access
- No posting/voting/commenting
- Maximum privacy
- 1-hour session expiry

### 4. Security Implementation

#### Nonce Structure
- Format: `pollify-auth-{timestamp}-{random}`
- Stored with 5-minute expiration
- One-time use only
- Deleted after verification

#### JWT Token Payload
```json
{
  "user_id": "uuid",
  "wallet_address": "addr1...",
  "mode": "shadow",
  "session_id": "uuid",
  "iat": 1234567890,
  "exp": 1234654290
}
```

#### Rate Limiting
- `/api/v1/auth/nonce`: 10 per minute per IP
- `/api/v1/auth/verify`: 5 per minute per wallet
- General API: 100 per minute per user

### 5. Frontend Integration

#### Check Wallet Availability
```javascript
const isLaceAvailable = () => {
  return window.cardano && window.cardano.lace;
}
```

#### Connect Wallet
```javascript
const connectWallet = async () => {
  const api = await window.cardano.lace.enable();
  const addresses = await api.getUsedAddresses();
  return addresses[0];
}
```

#### Sign Message
```javascript
const signMessage = async (address, nonce) => {
  const hexNonce = Buffer.from(nonce).toString('hex');
  return await api.signData(address, hexNonce);
}
```

### 6. Events Emitted

- `auth:user:created` - New user registered
- `auth:user:authenticated` - User logged in
- `auth:user:mode_changed` - User switched modes
- `auth:session:expired` - Session expired

### 7. Error Codes

- `WALLET_NOT_FOUND` - Wallet not installed
- `INVALID_SIGNATURE` - Signature verification failed
- `NONCE_EXPIRED` - Nonce older than 5 minutes
- `INVALID_TOKEN` - JWT verification failed
- `SESSION_EXPIRED` - Session has expired
- `INVALID_MODE` - Invalid mode specified
- `RATE_LIMITED` - Too many requests

### 8. Database Schema

See `/docs/database-schema.md` for complete table definitions.

### 9. Integration Points

Other modules check authentication via:
```javascript
// Middleware usage
app.get('/protected', authenticate, (req, res) => {
  // req.user available here
});

// Mode-specific routes
app.post('/create', requireMode(['true', 'shadow']), (req, res) => {
  // Only true self and shadow can post
});
```

### 10. Future Enhancements

- Support for additional wallets (Nami, Eternl)
- WebAuthn as alternative authentication
- Session management UI
- Two-factor authentication
- Account recovery mechanism
