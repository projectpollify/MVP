import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { EventEmitter } from 'events';

// Module imports
import { initializeDatabaseModule } from './modules/database';
import { initializeAuthModule } from './modules/auth';
import { initializeGroupsModule } from './modules/groups';
import { initializeBlockchainModule } from './blockchain';
import { initializeEngagementModule } from './modules/engagement';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create shared event emitter
const eventEmitter = new EventEmitter();

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Initialize all modules
async function initializeApp() {
  try {
    console.log('Starting Pollify.net server...');

    // Module 1: Database
    const databaseModule = await initializeDatabaseModule({
      pool,
      eventEmitter
    });
    console.log('✅ Module 1 (Database) initialized');

    // Module 2: Authentication
    const authModule = await initializeAuthModule({
      app,
      pool,
      eventEmitter
    });
    console.log('✅ Module 2 (Authentication) initialized');

    // Module 3: Groups
    const groupsModule = await initializeGroupsModule({
      app,
      pool,
      eventEmitter
    });
    console.log('✅ Module 3 (Groups) initialized');

    // Module 4: Blockchain
    const blockchainModule = await initializeBlockchainModule({
      app,
      pool,
      eventEmitter
    });
    console.log('✅ Module 4 (Blockchain) initialized');

    // Module 5: Engagement
    const engagementModule = await initializeEngagementModule({
      app,
      db: pool,
      eventEmitter,
      blockchainService: blockchainModule.getCardanoService(),
      tokenRegistry: blockchainModule.getTokenRegistry()
    });
    console.log('✅ Module 5 (Engagement) initialized');

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        modules: {
          database: 'active',
          auth: 'active',
          groups: 'active',
          blockchain: 'active',
          engagement: 'active'
        },
        timestamp: new Date().toISOString()
      });
    });

    // Root endpoint
    app.get('/', (req, res) => {
      res.json({
        name: 'Pollify.net API',
        version: '1.0.0',
        modules: [
          'database',
          'authentication',
          'groups',
          'blockchain',
          'engagement'
        ]
      });
    });

    // Error handling middleware
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Error:', err);
      res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error'
      });
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Pollify.net server running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
    });

    // Handle shutdown gracefully
    process.on('SIGINT', async () => {
      console.log('\nShutting down gracefully...');
      await pool.end();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

// Start the application
initializeApp();

// Export for testing
export { app, pool, eventEmitter };
