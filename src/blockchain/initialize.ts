import { Express } from 'express';
import { Pool } from 'pg';
import { EventEmitter } from 'events';
import blockchainRoutes from './blockchain.routes';
import { blockchainManager } from './blockchain.manager';
import { tokenRegistry } from './tokens/token.registry';
import { cardanoService } from './services/cardano.service';

export interface BlockchainModuleConfig {
  app: Express;
  pool: Pool;
  eventEmitter: EventEmitter;
}

export class BlockchainModule {
  constructor(private config: BlockchainModuleConfig) {
    // Set up routes
    config.app.use('/api/v1/blockchain', blockchainRoutes);
  }

  getCardanoService() {
    return cardanoService;
  }

  getTokenRegistry() {
    return tokenRegistry;
  }

  getBlockchainManager() {
    return blockchainManager;
  }
}

export async function initializeBlockchainModule(config: BlockchainModuleConfig): Promise<BlockchainModule> {
  return new BlockchainModule(config);
}
