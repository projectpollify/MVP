-- Neural Pollinator (Thought Pods) System

-- Pillars reference table
CREATE TABLE IF NOT EXISTS pillars (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    lens_type VARCHAR(100) NOT NULL,
    description TEXT
);

-- Insert the 7 pillars
INSERT INTO pillars (id, name, lens_type, description) VALUES
(1, 'Data & Analytics', 'Data', 'Examining through quantitative analysis and empirical evidence'),
(2, 'Ethics & Values', 'Ethics', 'Exploring moral implications and value systems'),
(3, 'Human Experience', 'Human Impact', 'Understanding effects on individuals and communities'),
(4, 'Economic Systems', 'Economics', 'Analyzing financial and resource implications'),
(5, 'Historical Context', 'History', 'Learning from past patterns and precedents'),
(6, 'Systems Thinking', 'Systems', 'Viewing interconnections and complex relationships'),
(7, 'Future Scenarios', 'Foresight', 'Projecting potential outcomes and possibilities')
ON CONFLICT (id) DO NOTHING;

-- Thought Pods
CREATE TABLE IF NOT EXISTS thought_pods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pillar_id INTEGER NOT NULL REFERENCES pillars(id),
    topic TEXT NOT NULL,
    description TEXT,
    phase VARCHAR(50) DEFAULT 'exploration' CHECK (phase IN (
        'exploration', 'deepening', 'synthesis', 'conclusion'
    )),
    is_focus_pod BOOLEAN DEFAULT false,
    focus_vote_count INTEGER DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    starts_at TIMESTAMP NOT NULL,
    closes_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Pod discussions with required sources
CREATE TABLE IF NOT EXISTS pod_discussions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID NOT NULL REFERENCES thought_pods(id),
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    phase VARCHAR(50) NOT NULL,
    parent_id UUID REFERENCES pod_discussions(id), -- For threaded discussions
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sources are required for pod discussions
CREATE TABLE IF NOT EXISTS pod_discussion_sources (
    discussion_id UUID NOT NULL REFERENCES pod_discussions(id),
    source_id UUID NOT NULL REFERENCES post_sources(id),
    PRIMARY KEY (discussion_id, source_id)
);

-- Focus voting (costs 1 PCO)
CREATE TABLE IF NOT EXISTS pod_focus_votes (
    pod_id UUID NOT NULL REFERENCES thought_pods(id),
    user_id UUID NOT NULL REFERENCES users(id),
    tx_hash VARCHAR(255) NOT NULL, -- PCO payment
    voted_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (pod_id, user_id)
);

-- Truth archaeology timeline
CREATE TABLE IF NOT EXISTS truth_timeline_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID NOT NULL REFERENCES thought_pods(id),
    entry_type VARCHAR(50) CHECK (entry_type IN (
        'claim_made', 'source_added', 'claim_challenged', 
        'consensus_shift', 'phase_transition'
    )),
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_thought_pods_pillar ON thought_pods(pillar_id);
CREATE INDEX idx_thought_pods_focus ON thought_pods(is_focus_pod);
CREATE INDEX idx_thought_pods_phase ON thought_pods(phase);
CREATE INDEX idx_pod_discussions_pod ON pod_discussions(pod_id);
CREATE INDEX idx_pod_discussions_user ON pod_discussions(user_id);
CREATE INDEX idx_truth_timeline_pod ON truth_timeline_entries(pod_id);

-- Update triggers
CREATE TRIGGER update_thought_pods_updated_at BEFORE UPDATE ON thought_pods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
