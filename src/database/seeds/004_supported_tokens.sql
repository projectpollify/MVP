-- src/database/seeds/004_supported_tokens.sql

-- Seed data for supported tokens
-- This adds PCO and Gratium tokens for the MVP

INSERT INTO supported_tokens (
    symbol,
    chain,
    token_type,
    policy_id,
    asset_name,
    decimals,
    display_name,
    description,
    is_active,
    config
) VALUES 
(
    'PCO',
    'cardano',
    'governance',
    'test_policy_id_pco_preprod', -- Replace with actual policy ID after minting
    'PollCoin',
    6,
    'Poll Coin',
    'Governance token for Pollify platform. Used for voting, staking, and platform governance.',
    true,
    '{
        "initial_supply": "1000000000",
        "max_supply": "10000000000",
        "minting_enabled": true,
        "burning_enabled": true,
        "features": ["voting", "staking", "governance"]
    }'::jsonb
),
(
    'GRATIUM',
    'cardano',
    'appreciation',
    'test_policy_id_gratium_preprod', -- Replace with actual policy ID after minting
    'Gratium',
    0,
    'Gratium',
    'Appreciation token for content creators. Non-divisible token used to show gratitude.',
    true,
    '{
        "initial_supply": "0",
        "max_supply": null,
        "minting_enabled": true,
        "burning_enabled": false,
        "features": ["tipping", "rewards", "appreciation"]
    }'::jsonb
)
ON CONFLICT (symbol) DO UPDATE SET
    chain = EXCLUDED.chain,
    token_type = EXCLUDED.token_type,
    decimals = EXCLUDED.decimals,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    config = EXCLUDED.config,
    updated_at = NOW();

-- Placeholder entries for future tokens (inactive)
INSERT INTO supported_tokens (
    symbol,
    chain,
    token_type,
    policy_id,
    asset_name,
    decimals,
    display_name,
    description,
    is_active,
    config
) VALUES 
(
    'COSMOFLUX',
    'cardano',
    'utility',
    null,
    'Cosmoflux',
    6,
    'Cosmoflux',
    'Cosmic energy token for advanced platform features.',
    false,
    '{
        "planned_features": ["energy_system", "premium_features"],
        "status": "planned"
    }'::jsonb
),
(
    'THOUGHT',
    'cardano',
    'utility',
    null,
    'Thought',
    8,
    'Thought Token',
    'Intellectual contribution token for knowledge sharing.',
    false,
    '{
        "planned_features": ["knowledge_rewards", "education"],
        "status": "planned"
    }'::jsonb
)
ON CONFLICT (symbol) DO NOTHING;

-- Add initial faucet configuration
INSERT INTO supported_tokens (
    symbol,
    chain,
    token_type,
    policy_id,
    asset_name,
    decimals,
    display_name,
    description,
    is_active,
    config
) VALUES 
(
    'tPCO',
    'cardano',
    'governance',
    'test_policy_id_tpco_preprod',
    'testPollCoin',
    6,
    'Test Poll Coin',
    'Test version of Poll Coin for Preprod testnet.',
    true,
    '{
        "is_testnet": true,
        "faucet_enabled": true,
        "faucet_amount": "100000000",
        "faucet_cooldown_hours": 24,
        "parent_token": "PCO"
    }'::jsonb
),
(
    'tGRATIUM',
    'cardano',
    'appreciation',
    'test_policy_id_tgratium_preprod',
    'testGratium',
    0,
    'Test Gratium',
    'Test version of Gratium for Preprod testnet.',
    true,
    '{
        "is_testnet": true,
        "faucet_enabled": true,
        "faucet_amount": "100",
        "faucet_cooldown_hours": 24,
        "parent_token": "GRATIUM"
    }'::jsonb
)
ON CONFLICT (symbol) DO UPDATE SET
    config = EXCLUDED.config,
    updated_at = NOW();
