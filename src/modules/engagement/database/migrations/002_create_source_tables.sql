-- Source Verification System Tables
-- Allows attaching sources to posts/comments with AI summaries and credibility voting

CREATE TABLE IF NOT EXISTS post_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    domain TEXT NOT NULL, -- Extracted domain for reputation tracking
    title TEXT,
    description TEXT,
    image_url TEXT,
    ai_summary TEXT,
    fetch_status VARCHAR(50) DEFAULT 'pending', -- pending, fetched, failed
    credibility_score DECIMAL(3,2) DEFAULT 0.50, -- 0.00 to 1.00
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT source_belongs_to_content CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL) OR 
        (post_id IS NULL AND comment_id IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS source_votes (
    source_id UUID NOT NULL REFERENCES post_sources(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    vote INTEGER NOT NULL CHECK (vote IN (-1, 1)), -- -1 downvote, 1 upvote
    voted_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (source_id, user_id)
);

-- Domain reputation tracking
CREATE TABLE IF NOT EXISTS domain_reputation (
    domain TEXT PRIMARY KEY,
    total_sources INTEGER DEFAULT 0,
    total_upvotes INTEGER DEFAULT 0,
    total_downvotes INTEGER DEFAULT 0,
    reputation_score DECIMAL(3,2) DEFAULT 0.50,
    last_updated TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_post_sources_post_id ON post_sources(post_id);
CREATE INDEX idx_post_sources_comment_id ON post_sources(comment_id);
CREATE INDEX idx_post_sources_domain ON post_sources(domain);
CREATE INDEX idx_post_sources_fetch_status ON post_sources(fetch_status);
CREATE INDEX idx_source_votes_user_id ON source_votes(user_id);
CREATE INDEX idx_domain_reputation_score ON domain_reputation(reputation_score);

-- Update trigger for sources
CREATE TRIGGER update_post_sources_updated_at BEFORE UPDATE ON post_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
