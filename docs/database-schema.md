# Pollify Database Schema

## Core Tables (Module 1)

### users
Primary user table for all authentication and profile data.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_pub_key VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    mode BOOLEAN DEFAULT true, -- true=shadow, false=true_self
    pillar_id INTEGER,
    reputation_score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_wallet ON users(wallet_pub_key);
CREATE INDEX idx_users_pillar ON users(pillar_id);
```

### user_settings
User preferences and configuration.

```sql
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    email_verified BOOLEAN DEFAULT false,
    notifications_enabled BOOLEAN DEFAULT true,
    theme VARCHAR(20) DEFAULT 'system',
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_settings_user ON user_settings(user_id);
```

## Authentication Tables (Module 2)

### sessions
Active user sessions for JWT validation.

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    mode VARCHAR(10) NOT NULL, -- 'true', 'shadow', 'soul'
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

### nonces
Temporary nonces for wallet authentication.

```sql
CREATE TABLE nonces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(255) UNIQUE NOT NULL,
    nonce VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_nonces_wallet ON nonces(wallet_address);
CREATE INDEX idx_nonces_expires ON nonces(expires_at);
```

### email_verifications
Email verification tokens and status.

```sql
CREATE TABLE email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_email_verifications_user ON email_verifications(user_id);
CREATE INDEX idx_email_verifications_token ON email_verifications(token);
```

## Module Naming Convention

Each module creates tables with their module name as prefix:
- Module 3: `groups_*`, `posts_*`
- Module 4: `blockchain_*`, `tokens_*`
- Module 5: `tips_*`, `engagement_*`
- Module 6: `reputation_*`, `stakes_*`
- Module 7: `moderation_*`, `reports_*`
- Module 8: `search_*` (indexes)
- Module 9: `analytics_*`
- Module 10: `admin_*`

## Shared Columns

All tables should include these columns:
```sql
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()
```

## Data Types
- IDs: UUID
- Wallet addresses: VARCHAR(255)
- Amounts: BIGINT (store in lovelace)
- Timestamps: TIMESTAMP WITH TIME ZONE
- JSON data: JSONB

## Indexes Strategy
- Primary keys automatically indexed
- Foreign keys should be indexed
- Columns used in WHERE clauses
- Columns used in JOIN conditions
- Composite indexes for common query patterns

## Constraints
- Use foreign key constraints
- Add CHECK constraints for enums
- NOT NULL for required fields
- UNIQUE for natural keys

## Prisma Schema

See `/prisma/schema.prisma` for the Prisma ORM representation of this database schema.
