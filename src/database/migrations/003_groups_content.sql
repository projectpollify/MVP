-- Add columns to pillars table
ALTER TABLE pillars ADD COLUMN color_hex VARCHAR(7) NOT NULL DEFAULT '#000000';
ALTER TABLE pillars ADD COLUMN icon_name VARCHAR(50) NOT NULL DEFAULT 'circle';
ALTER TABLE pillars ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pillars ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Add columns to groups table
ALTER TABLE groups ADD COLUMN member_count INTEGER DEFAULT 0;
ALTER TABLE groups ADD COLUMN post_count INTEGER DEFAULT 0;
ALTER TABLE groups ADD COLUMN last_activity_at TIMESTAMP;
ALTER TABLE groups ADD COLUMN created_by UUID REFERENCES users(id);
ALTER TABLE groups ADD COLUMN is_default BOOLEAN DEFAULT false;

-- Add columns to posts table
ALTER TABLE posts ADD COLUMN parent_id UUID REFERENCES posts(id);
ALTER TABLE posts ADD COLUMN view_count INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN is_edited BOOLEAN DEFAULT false;
ALTER TABLE posts ADD COLUMN edited_at TIMESTAMP;
ALTER TABLE posts ADD COLUMN is_deleted BOOLEAN DEFAULT false;
ALTER TABLE posts ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE posts ADD COLUMN thread_depth INTEGER DEFAULT 0;

-- Create indexes
CREATE INDEX idx_posts_parent_id ON posts(parent_id);
CREATE INDEX idx_posts_created_at ON posts(created_at);
CREATE INDEX idx_posts_group_id_created_at ON posts(group_id, created_at);

-- Create post_sources table
CREATE TABLE post_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title VARCHAR(500),
    description TEXT,
    ai_summary VARCHAR(500),
    credibility_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create post_flags table
CREATE TABLE post_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id),
    user_id UUID NOT NULL REFERENCES users(id),
    reason VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);
