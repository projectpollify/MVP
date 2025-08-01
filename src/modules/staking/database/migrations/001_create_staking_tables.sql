-- Module 6: Staking System Tables
-- This migration creates all necessary tables for the PCO staking functionality

-- Staking pools configuration table
CREATE TABLE IF NOT EXISTS staking_pools (
    id SERIAL PRIMARY KEY,
    pool_name VARCHAR(50) NOT NULL,
    lock_days INTEGER NOT NULL,
    apr_rate DECIMAL(5,2) NOT NULL,
    early_penalty_rate DECIMAL(5,2) NOT NULL,
    min_stake DECIMAL(20,6) DEFAULT 10,
    max_stake DECIMAL(20,6),
    total_staked DECIMAL(20,6) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User stakes table
CREATE TABLE IF NOT EXISTS user_stakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    pool_id INTEGER NOT NULL REFERENCES staking_pools(id),
    stake_amount DECIMAL(20,6) NOT NULL,
    reward_amount DECIMAL(20,6) DEFAULT 0,
    stake_date TIMESTAMP DEFAULT NOW(),
    unlock_date TIMESTAMP NOT NULL,
    unstake_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active', -- active, completed, early_exit
    tx_hash_stake VARCHAR(255),
    tx_hash_unstake VARCHAR(255),
    penalty_amount DECIMAL(20,6),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, pool_id, status) -- One active stake per pool per user
);

-- Index for performance
CREATE INDEX idx_user_stakes_user_id ON user_stakes(user_id);
CREATE INDEX idx_user_stakes_status ON user_stakes(status);
CREATE INDEX idx_user_stakes_unlock_date ON user_stakes(unlock_date);

-- Staking rewards tracking table
CREATE TABLE IF NOT EXISTS staking_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stake_id UUID NOT NULL REFERENCES user_stakes(id),
    reward_amount DECIMAL(20,6) NOT NULL,
    penalty_amount DECIMAL(20,6) DEFAULT 0,
    calculation_date TIMESTAMP DEFAULT NOW(),
    claimed BOOLEAN DEFAULT false,
    tx_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for rewards
CREATE INDEX idx_staking_rewards_stake_id ON staking_rewards(stake_id);
CREATE INDEX idx_staking_rewards_claimed ON staking_rewards(claimed);

-- Staking statistics table (for analytics)
CREATE TABLE IF NOT EXISTS staking_statistics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_staked DECIMAL(20,6) DEFAULT 0,
    total_rewards_paid DECIMAL(20,6) DEFAULT 0,
    total_penalties_burned DECIMAL(20,6) DEFAULT 0,
    active_stakes_count INTEGER DEFAULT 0,
    new_stakes_count INTEGER DEFAULT 0,
    unstakes_count INTEGER DEFAULT 0,
    early_exits_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(date)
);

-- Seed the 5 staking pools
INSERT INTO staking_pools (pool_name, lock_days, apr_rate, early_penalty_rate) VALUES
('7 Day Pool', 7, 3.0, 50.0),
('30 Day Pool', 30, 4.0, 60.0),
('90 Day Pool', 90, 5.0, 70.0),
('180 Day Pool', 180, 6.0, 80.0),
('365 Day Pool', 365, 7.0, 90.0)
ON CONFLICT DO NOTHING;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_staking_pools_updated_at BEFORE UPDATE ON staking_pools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_stakes_updated_at BEFORE UPDATE ON user_stakes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for user stake summaries
CREATE VIEW user_stake_summary AS
SELECT 
    u.wallet_pub_key,
    us.user_id,
    COUNT(CASE WHEN us.status = 'active' THEN 1 END) as active_stakes,
    SUM(CASE WHEN us.status = 'active' THEN us.stake_amount ELSE 0 END) as total_staked,
    SUM(us.reward_amount) as total_rewards_earned,
    SUM(us.penalty_amount) as total_penalties_paid
FROM user_stakes us
JOIN users u ON us.user_id = u.id
GROUP BY u.wallet_pub_key, us.user_id;
