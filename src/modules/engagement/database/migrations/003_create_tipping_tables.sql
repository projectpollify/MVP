-- Gratium Tipping System Tables

CREATE TABLE IF NOT EXISTS gratium_tips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES users(id),
    to_user_id UUID NOT NULL REFERENCES users(id),
    amount INTEGER DEFAULT 1, -- Always 1 GRATIUM for MVP
    tx_hash VARCHAR(255) NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT tip_belongs_to_content CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL) OR 
        (post_id IS NULL AND comment_id IS NOT NULL)
    ),
    CONSTRAINT no_self_tipping CHECK (from_user_id != to_user_id)
);

-- Daily tip limits
CREATE TABLE IF NOT EXISTS user_daily_tips (
    user_id UUID NOT NULL REFERENCES users(id),
    date DATE NOT NULL,
    tip_count INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, date)
);

-- Indexes
CREATE INDEX idx_gratium_tips_post_id ON gratium_tips(post_id);
CREATE INDEX idx_gratium_tips_comment_id ON gratium_tips(comment_id);
CREATE INDEX idx_gratium_tips_from_user ON gratium_tips(from_user_id);
CREATE INDEX idx_gratium_tips_to_user ON gratium_tips(to_user_id);
CREATE INDEX idx_gratium_tips_created_at ON gratium_tips(created_at);
