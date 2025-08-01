-- Poll System Tables for Module 5
-- This creates the core infrastructure for blockchain-recorded polls

-- Main polls table
CREATE TABLE IF NOT EXISTS polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    poll_type VARCHAR(50) DEFAULT 'single_choice',
    duration_hours INTEGER NOT NULL CHECK (duration_hours IN (24, 72, 168)), -- 24h, 3d, 7d
    closes_at TIMESTAMP NOT NULL,
    is_closed BOOLEAN DEFAULT false,
    total_votes INTEGER DEFAULT 0,
    blockchain_tx_hash VARCHAR(255), -- Set when poll closes
    fee_tx_hash VARCHAR(255) NOT NULL, -- PCO payment transaction
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Poll options
CREATE TABLE IF NOT EXISTS poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    option_order INTEGER NOT NULL,
    vote_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Track individual votes
CREATE TABLE IF NOT EXISTS poll_votes (
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    option_id UUID NOT NULL REFERENCES poll_options(id),
    voted_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (poll_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_polls_post_id ON polls(post_id);
CREATE INDEX idx_polls_closes_at ON polls(closes_at) WHERE is_closed = false;
CREATE INDEX idx_polls_created_by ON polls(created_by);
CREATE INDEX idx_poll_options_poll_id ON poll_options(poll_id);
CREATE INDEX idx_poll_votes_user_id ON poll_votes(user_id);

-- Add update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_polls_updated_at BEFORE UPDATE ON polls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
