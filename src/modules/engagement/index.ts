import { Express } from 'express';
import { Pool } from 'pg';
import { EventEmitter } from 'events';

// Services
import { PollService } from './polls/poll.service';
import { SourceService } from './sources/source.service';
import { TippingService } from './tipping/tipping.service';
import { FlagService } from './flags/flag.service';
import { NeuralPollinatorService } from './neural-pollinator/neural-pollinator.service';

// Controllers
import { PollController } from './polls/poll.controller';
import { SourceController } from './sources/source.controller';
import { TippingController } from './tipping/tipping.controller';
import { FlagController } from './flags/flag.controller';
import { NeuralPollinatorController } from './neural-pollinator/neural-pollinator.controller';

// Routes
import { createPollRoutes } from './polls/poll.routes';
import { createSourceRoutes } from './sources/source.routes';
import { createTippingRoutes } from './tipping/tipping.routes';
import { createFlagRoutes } from './flags/flag.routes';
import { createNeuralPollinatorRoutes } from './neural-pollinator/neural-pollinator.routes';

export interface EngagementModuleConfig {
  app: Express;
  db: Pool;
  eventEmitter: EventEmitter;
  blockchainService: any;
  tokenRegistry: any;
  aiService?: any; // Optional AI service for summaries
}

export class EngagementModule {
  private pollService: PollService;
  private sourceService: SourceService;
  private tippingService: TippingService;
  private flagService: FlagService;
  private neuralPollinatorService: NeuralPollinatorService;

  constructor(private config: EngagementModuleConfig) {
    this.pollService = new PollService(
      config.db,
      config.eventEmitter,
      config.blockchainService,
      config.tokenRegistry
    );

    this.sourceService = new SourceService(
      config.db,
      config.eventEmitter,
      config.aiService
    );

    this.tippingService = new TippingService(
      config.db,
      config.eventEmitter,
      config.blockchainService,
      config.tokenRegistry
    );

    this.flagService = new FlagService(
      config.db,
      config.eventEmitter
    );

    this.neuralPollinatorService = new NeuralPollinatorService(
      config.db,
      config.eventEmitter,
      config.blockchainService,
      config.tokenRegistry
    );

    this.setupRoutes();
    this.setupEventListeners();
    this.startBackgroundJobs();
  }

  private setupRoutes() {
    // Poll routes
    const pollController = new PollController(this.pollService);
    this.config.app.use('/api/v1/polls', createPollRoutes(pollController));

    // Source routes
    const sourceController = new SourceController(this.sourceService);
    this.config.app.use('/api/v1/sources', createSourceRoutes(sourceController));

    // Tipping routes
    const tippingController = new TippingController(this.tippingService);
    this.config.app.use('/api/v1/tips', createTippingRoutes(tippingController));

    // Flag routes
    const flagController = new FlagController(this.flagService);
    this.config.app.use('/api/v1/flags', createFlagRoutes(flagController));

    // Neural Pollinator routes
    const npController = new NeuralPollinatorController(this.neuralPollinatorService);
    this.config.app.use('/api/v1/thought-pods', createNeuralPollinatorRoutes(npController));

    console.log('Module 5 routes initialized:');
    console.log('- Polls: /api/v1/polls');
    console.log('- Sources: /api/v1/sources');
    console.log('- Tips: /api/v1/tips');
    console.log('- Flags: /api/v1/flags');
    console.log('- Thought Pods: /api/v1/thought-pods');
  }

  private setupEventListeners() {
    // Cross-module event handling
    this.config.eventEmitter.on('post:created', async (data) => {
      console.log('[Module 5] New post available for engagement:', data.postId);
    });

    this.config.eventEmitter.on('token:transferred', async (data) => {
      if (data.token === 'GRATIUM') {
        console.log('[Module 5] Gratium tip recorded:', data.txHash);
        // Could update reputation scores
      }
    });

    this.config.eventEmitter.on('content:auto_hidden', async (data) => {
      console.log('[Module 5] Content auto-hidden due to flags:', data);
      // Could notify moderators
    });

    this.config.eventEmitter.on('pod:phase_advanced', async (data) => {
      console.log('[Module 5] Thought pod phase advanced:', data);
      // Could notify participants
    });
  }

  private startBackgroundJobs() {
    // Check for expired polls every 5 minutes
    setInterval(async () => {
      try {
        await this.pollService.closeExpiredPolls();
      } catch (error) {
        console.error('Error closing expired polls:', error);
      }
    }, 5 * 60 * 1000);

    // Update focus pod monthly (run daily to catch month boundaries)
    setInterval(async () => {
      try {
        await this.updateMonthlyFocusPod();
      } catch (error) {
        console.error('Error updating focus pod:', error);
      }
    }, 24 * 60 * 60 * 1000); // Daily

    console.log('Module 5 background jobs started');
  }

  private async updateMonthlyFocusPod() {
    // Check if it's the first day of the month
    const now = new Date();
    if (now.getDate() !== 1) return;

    try {
      // Reset all pods to non-focus
      await this.config.db.query(
        'UPDATE thought_pods SET is_focus_pod = false'
      );

      // Set highest voted pod as focus
      const result = await this.config.db.query(
        `UPDATE thought_pods 
         SET is_focus_pod = true 
         WHERE id = (
           SELECT id FROM thought_pods 
           ORDER BY focus_vote_count DESC 
           LIMIT 1
         )
         RETURNING id`
      );

      if (result.rows.length > 0) {
        console.log('New monthly focus pod:', result.rows[0].id);
        
        // Reset vote counts for next month
        await this.config.db.query(
          'UPDATE thought_pods SET focus_vote_count = 0'
        );
      }
    } catch (error) {
      console.error('Error updating monthly focus pod:', error);
    }
  }

  // Public methods for other modules
  public getPollService(): PollService {
    return this.pollService;
  }

  public getSourceService(): SourceService {
    return this.sourceService;
  }

  public getTippingService(): TippingService {
    return this.tippingService;
  }

  public getFlagService(): FlagService {
    return this.flagService;
  }

  public getNeuralPollinatorService(): NeuralPollinatorService {
    return this.neuralPollinatorService;
  }
}

export function initializeEngagementModule(config: EngagementModuleConfig): EngagementModule {
  return new EngagementModule(config);
}
