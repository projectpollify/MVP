-- src/database/migrations/004_blockchain_tokens.sql

-- Migration for Module 4: Blockchain & Token Support
-- Run this after the existing Module 1-3 migrations

-- Update token_transactions table for multi-chain and multi-token support
ALTER TABLE token_transactions 
ADD COLUMN IF NOT EXISTS chain VARCHAR(50) DEFAULT 'cardano',
ADD COLUMN IF NOT EXISTS token_symbol VARCHAR(50) DEFAULT 'PCO',
ADD COLUMN IF NOT EXISTS token_type VARCHAR(20) DEFAULT 'fungible' CHECK (token_type IN ('fungible', 'nft')),
ADD COLUMN IF NOT EXISTS token_id VARCHAR(255) NULL, -- For NFT token IDs
ADD COLUMN IF NOT EXISTS metadata_uri TEXT NULL, -- For NFT metadata URIs
ADD COLUMN IF NOT EXISTS metadata JSONB NULL; -- For additional transaction metadata

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_token_transactions_chain_token ON token_transactions(chain, token_symbol);
CREATE INDEX IF NOT EXISTS idx_token_transactions_wallet ON token_transactions(from_wallet, to_wallet);

-- Add new table for supported tokens
CREATE TABLE IF NOT EXISTS supported_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(50) UNIQUE NOT NULL,
    chain VARCHAR(50) NOT NULL,
    token_type VARCHAR(50) NOT NULL,
    policy_id VARCHAR(255), -- Cardano policy ID
    asset_name VARCHAR(255), -- Cardano asset name
    contract_address VARCHAR(255), -- For EVM chains
    decimals INTEGER DEFAULT 0,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}', -- Additional configuration
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_supported_tokens_chain ON supported_tokens(chain);
CREATE INDEX IF NOT EXISTS idx_supported_tokens_active ON supported_tokens(is_active);

-- Add table for blockchain records (immutable data)
CREATE TABLE IF NOT EXISTS blockchain_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_hash VARCHAR(255) UNIQUE NOT NULL,
    chain VARCHAR(50) NOT NULL DEFAULT 'cardano',
    record_type VARCHAR(50) NOT NULL CHECK (record_type IN (
        'poll_result', 
        'moderation', 
        'reputation', 
        'source_verification', 
        'governance'
    )),
    data_hash VARCHAR(255) NOT NULL, -- SHA256 hash of the data
    data JSONB NOT NULL, -- The actual data stored
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP NULL,
    confirmations INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed'))
);

-- Create indexes for blockchain records
CREATE INDEX IF NOT EXISTS idx_blockchain_records_type ON blockchain_records(record_type);
CREATE INDEX IF NOT EXISTS idx_blockchain_records_status ON blockchain_records(status);
CREATE INDEX IF NOT EXISTS idx_blockchain_records_created_by ON blockchain_records(created_by);

-- Add table for wallet nonces (for authentication)
CREATE TABLE IF NOT EXISTS wallet_nonces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(255) NOT NULL,
    nonce VARCHAR(255) NOT NULL,
    chain VARCHAR(50) DEFAULT 'cardano',
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for nonce lookups
CREATE INDEX IF NOT EXISTS idx_wallet_nonces_address ON wallet_nonces(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_nonces_expires ON wallet_nonces(expires_at);

-- Add table for faucet claims
CREATE TABLE IF NOT EXISTS faucet_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(255) NOT NULL,
    token_symbol VARCHAR(50) NOT NULL,
    amount BIGINT NOT NULL,
    tx_hash VARCHAR(255),
    chain VARCHAR(50) DEFAULT 'cardano',
    claimed_at TIMESTAMP DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    UNIQUE(wallet_address, token_symbol, DATE(claimed_at)) -- One claim per token per day
);

-- Create index for faucet claims
CREATE INDEX IF NOT EXISTS idx_faucet_claims_wallet ON faucet_claims(wallet_address);
CREATE INDEX IF NOT EXISTS idx_faucet_claims_claimed_at ON faucet_claims(claimed_at);

-- Add columns to users table for blockchain integration
ALTER TABLE users
ADD COLUMN IF NOT EXISTS stake_address VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS primary_chain VARCHAR(50) DEFAULT 'cardano',
ADD COLUMN IF NOT EXISTS wallet_metadata JSONB DEFAULT '{}';

-- Create index for stake address lookups
CREATE INDEX IF NOT EXISTS idx_users_stake_address ON users(stake_address);

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update trigger for supported_tokens
CREATE TRIGGER update_supported_tokens_updated_at BEFORE UPDATE ON supported_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
