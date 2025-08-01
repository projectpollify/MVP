/**
 * Staking Module (Module 6)
 * Implements PCO token staking with fixed-duration pools and rewards
 */

import { Pool } from 'pg';
import { EventEmitter } from '../../core/events';
import { Module } from '../../core/types';
import { StakingService } from './services/staking.service';
import { StakingStatsService } from './services/stats.service';
import { createStakingRoutes } from './routes/staking.routes';
import { STAKING_POOLS } from './config/pools.config';

// Import blockchain services from Module 4
import { BlockchainModule } from '../blockchain';

export class StakingModule implements Module {
  name = 'staking';
  version = '1.0.0';
  
  private stakingService: StakingService;
  private statsService: StakingStatsService;
  private db: Pool;
  private eventEmitter: EventEmitter;

  constructor(db: Pool, eventEmitter: EventEmitter, blockchainModule: BlockchainModule) {
    this.db = db;
    this.eventEmitter = eventEmitter;
    
    // Initialize services
    this.stakingService = new StakingService(
      db,
      eventEmitter,
      blockchainModule.getBlockchainService(),
      blockchainModule.getTokenService()
    );
    
    this.statsService = new StakingStatsService(db);
    
    // Register event listeners
    this.registerEventListeners();
  }

  /**
   * Initialize the module
   */
  async initialize(): Promise<void> {
    console.log('Initializing Staking Module...');
    
    // Run database migrations
    await this.runMigrations();
    
    // Verify staking pools are configured
    await this.verifyPools();
    
    // Start daily stats update job
    this.startStatsJob();
    
    console.log('Staking Module initialized successfully');
  }

  /**
   * Get Express router for this module
   */
  getRouter() {
    return createStakingRoutes(this.stakingService, this.statsService);
  }

  /**
   * Get staking service instance
   */
  getStakingService(): StakingService {
    return this.stakingService;
  }

  /**
   * Get statistics service instance
   */
  getStatsService(): StakingStatsService {
    return this.statsService;
  }

  /**
   * Register event listeners for integration with other modules
   */
  private registerEventListeners() {
    // Listen for blockchain events that might affect staking
    this.eventEmitter.on('blockchain:transaction_confirmed', async (event) => {
      // Handle confirmed transactions related to staking
      if (event.payload.type === 'stake' || event.payload.type === 'unstake') {
        await this.handleBlockchainConfirmation(event.payload);
      }
    });

    // Listen for token transfer events
    this.eventEmitter.on('token:transfer_completed', async (event) => {
      // Update stake records if needed
      if (event.payload.toAddress === 'staking_contract_address') {
        await this.handleTokenTransfer(event.payload);
      }
    });
  }

  /**
   * Run database migrations
   */
  private async runMigrations() {
    const client = await this.db.connect();
    try {
      // Check if migrations table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          module VARCHAR(50) NOT NULL,
          version VARCHAR(20) NOT NULL,
          applied_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(module, version)
        )
      `);

      // Check if this migration has been applied
      const result = await client.query(
        'SELECT * FROM migrations WHERE module = $1 AND version = $2',
        ['staking', '001']
      );

      if (result.rows.length === 0) {
        // Run the migration
        const fs = require('fs');
        const path = require('path');
        const migrationSQL = fs.readFileSync(
          path.join(__dirname, 'database/migrations/001_create_staking_tables.sql'),
          'utf8'
        );
        
        await client.query(migrationSQL);
        
        // Record migration
        await client.query(
          'INSERT INTO migrations (module, version) VALUES ($1, $2)',
          ['staking', '001']
        );
        
        console.log('Staking module migrations applied successfully');
      }
    } finally {
      client.release();
    }
  }

  /**
   * Verify staking pools are properly configured
   */
  private async verifyPools() {
    const result = await this.db.query('SELECT COUNT(*) FROM staking_pools WHERE is_active = true');
    const activePoolCount = parseInt(result.rows[0].count);
    
    if (activePoolCount !== STAKING_POOLS.length) {
      console.warn(`Expected ${STAKING_POOLS.length} active pools, found ${activePoolCount}`);
    }
  }

  /**
   * Start daily statistics update job
   */
  private startStatsJob() {
    // Run stats update daily at midnight
    const runDailyStats = async () => {
      try {
        await this.statsService.updateDailyStats();
        console.log('Daily staking statistics updated');
      } catch (error) {
        console.error('Error updating daily stats:', error);
      }
    };

    // Calculate milliseconds until midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    // Run at midnight, then every 24 hours
    setTimeout(() => {
      runDailyStats();
      setInterval(runDailyStats, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  /**
   * Handle blockchain confirmation events
   */
  private async handleBlockchainConfirmation(payload: any) {
    // Update stake records with confirmed tx hash
    if (payload.type === 'stake') {
      await this.db.query(
        'UPDATE user_stakes SET tx_hash_stake = $1 WHERE id = $2',
        [payload.txHash, payload.stakeId]
      );
    } else if (payload.type === 'unstake') {
      await this.db.query(
        'UPDATE user_stakes SET tx_hash_unstake = $1 WHERE id = $2',
        [payload.txHash, payload.stakeId]
      );
    }
  }

  /**
   * Handle token transfer events
   */
  private async handleTokenTransfer(payload: any) {
    // Additional processing if needed when tokens are transferred to staking
    console.log('Token transfer to staking contract:', payload);
  }

  /**
   * Module cleanup
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up Staking Module...');
    // Any cleanup needed
  }
}

// Export types and utilities
export * from './types/staking.types';
export * from './config/pools.config';
export * from './utils/calculations';
