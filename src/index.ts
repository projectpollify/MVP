import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { EventEmitter } from 'events';

// Module imports
import { initializeDatabaseModule } from './modules/database';
import { initializeAuthModule } from './modules/auth';
import { moderationModule } from './modules/moderation';
import { initializeGroupsModule } from './modules/groups';
import { initializeBlockchainModule } from './blockchain';
import { initializeEngagementModule } from './modules/engagement';
import { StakingModule } from './modules/staking';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Global event emitter
export const eventEmitter = new EventEmitter();

// Initialize all modules
async function initializeModules() {
  try {
    // Module 1: Database
    await initializeDatabaseModule(pool);
    console.log('✅ Module 1: Database initialized');

    // Module 2: Auth
    await initializeAuthModule(app, pool);
    console.log('✅ Module 2: Authentication initialized');

    // Module 3: Groups
    await initializeGroupsModule(app, pool);
    console.log('✅ Module 3: Groups initialized');

    // Module 4: Blockchain
    await initializeBlockchainModule(app, pool);
    console.log('✅ Module 4: Blockchain initialized');

    // Module 5: Engagement
    await initializeEngagementModule(app, pool);
    console.log('✅ Module 5: Engagement initialized');

    // Module 6: Staking
    const stakingModule = new StakingModule(pool);
    await stakingModule.initialize(app);
    console.log('✅ Module 6: Staking initialized');

    // Module 7: Moderation
    await moderationModule.initialize({
      app,
      pool,
      basePath: '/api/v1/moderation'
    });
    console.log('✅ Module 7: Moderation initialized');

  } catch (error) {
    console.error('❌ Failed to initialize modules:', error);
    process.exit(1);
  }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Basic health check
    const dbCheck = await pool.query('SELECT NOW()');
    
    // Moderation stats
    const modStats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'active') as active_badges,
        COUNT(*) FILTER (WHERE status = 'offered') as pending_invitations,
        (SELECT COUNT(*) FROM content_flags WHERE resolved = false) as pending_flags
      FROM mod_badges
    `);

    res.json({
      status: 'healthy',
      timestamp: new Date(),
      database: dbCheck.rows[0].now ? 'connected' : 'disconnected',
      moderation: {
        healthy: true,
        activeBadges: parseInt(modStats.rows[0].active_badges) || 0,
        pendingInvitations: parseInt(modStats.rows[0].pending_invitations) || 0,
        pendingFlags: parseInt(modStats.rows[0].pending_flags) || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Start server
async function startServer() {
  try {
    await initializeModules();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully
