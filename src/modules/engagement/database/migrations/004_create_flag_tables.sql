-- Content Flagging/Reporting System

CREATE TABLE IF NOT EXISTS content_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('post', 'comment', 'source')),
    content_id UUID NOT NULL,
    flagged_by UUID NOT NULL REFERENCES users(id),
    reason VARCHAR(100) NOT NULL CHECK (reason IN (
        'spam', 'harassment', 'misinformation', 'inappropriate', 'other'
    )),
    details TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'reviewing', 'resolved', 'dismissed'
    )),
    resolution TEXT,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Track content visibility based on flags
CREATE TABLE IF NOT EXISTS flagged_content_status (
    content_type VARCHAR(50) NOT NULL,
    content_id UUID NOT NULL,
    flag_count INTEGER DEFAULT 0,
    is_hidden BOOLEAN DEFAULT false,
    hidden_at TIMESTAMP,
    PRIMARY KEY (content_type, content_id)
);

-- Indexes
CREATE INDEX idx_content_flags_content ON content_flags(content_type, content_id);
CREATE INDEX idx_content_flags_status ON content_flags(status);
CREATE INDEX idx_content_flags_flagged_by ON content_flags(flagged_by);
CREATE INDEX idx_flagged_content_status_hidden ON flagged_content_status(is_hidden);
