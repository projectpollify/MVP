// src/modules/blockchain/index.ts

// Export all blockchain module components

// Core exports
export * from './interfaces/blockchain.interface';
export * from './blockchain.manager';

// Token system
export * from './tokens/token.registry';

// Services
export * from './services/cardano.service';
export * from './services/record.service';
export * from './services/faucet.service';

// Routes
export { default as blockchainRoutes } from './blockchain.routes';

// Re-export commonly used instances
export { blockchainManager } from './blockchain.manager';
export { tokenRegistry } from './tokens/token.registry';
export { cardanoService } from './services/cardano.service';
export { recordService } from './services/record.service';
export { faucetService } from './services/faucet.service';
