// src/modules/blockchain/blockchain.manager.ts

import { IBlockchainService, IBlockchainManager } from './interfaces/blockchain.interface';
import { CardanoService } from './services/cardano.service';

/**
 * Blockchain Manager - Handles multiple blockchain integrations
 * Currently supports Cardano, with architecture ready for multi-chain
 */
export class BlockchainManager implements IBlockchainManager {
  private static instance: BlockchainManager;
  private services: Map<string, IBlockchainService>;
  private defaultChain: string;

  private constructor() {
    this.services = new Map();
    this.defaultChain = 'cardano';
    
    // Initialize services
    this.initializeServices();
  }

  private initializeServices(): void {
    // Initialize Cardano service
    this.services.set('cardano', new CardanoService());

    // Future chain services would be initialized here
    // this.services.set('tron', new TronService());
    // this.services.set('ethereum', new EthereumService());
  }

  static getInstance(): BlockchainManager {
    if (!BlockchainManager.instance) {
      BlockchainManager.instance = new BlockchainManager();
    }
    return BlockchainManager.instance;
  }

  /**
   * Get blockchain service for a specific chain
   */
  getService(chain?: string): IBlockchainService {
    const chainName = chain || this.defaultChain;
    const service = this.services.get(chainName);
    
    if (!service) {
      throw new Error(`Blockchain service for ${chainName} not found`);
    }
    
    return service;
  }

  /**
   * Get all supported chains
   */
  getSupportedChains(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get default chain
   */
  getDefaultChain(): string {
    return this.defaultChain;
  }

  /**
   * Set default chain
   */
  setDefaultChain(chain: string): void {
    if (!this.services.has(chain)) {
      throw new Error(`Chain ${chain} is not supported`);
    }
    this.defaultChain = chain;
  }

  /**
   * Check if a chain is supported
   */
  isChainSupported(chain: string): boolean {
    return this.services.has(chain);
  }

  /**
   * Get service for a specific token
   * Looks up the token in the registry to determine the chain
   */
  getServiceForToken(tokenSymbol: string): IBlockchainService {
    // Import here to avoid circular dependency
    const { tokenRegistry } = require('./tokens/token.registry');
    
    const token = tokenRegistry.getToken(tokenSymbol);
    if (!token) {
      throw new Error(`Token ${tokenSymbol} not found`);
    }
    
    return this.getService(token.chain);
  }

  /**
   * Validate address for any supported chain
   */
  isValidAddress(address: string, chain?: string): boolean {
    try {
      if (chain) {
        return this.getService(chain).isValidAddress(address);
      }
      
      // If no chain specified, check all chains
      for (const service of this.services.values()) {
        if (service.isValidAddress(address)) {
          return true;
        }
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Detect chain from address format
   */
  detectChainFromAddress(address: string): string | null {
    for (const [chain, service] of this.services.entries()) {
      if (service.isValidAddress(address)) {
        return chain;
      }
    }
    return null;
  }

  /**
   * Get all tokens for all supported chains
   */
  async getAllTokenBalances(address: string): Promise<Map<string, any>> {
    const { tokenRegistry } = require('./tokens/token.registry');
    const balances = new Map();

    for (const [chain, service] of this.services.entries()) {
      if (!service.isValidAddress(address)) continue;

      const tokens = tokenRegistry.getTokensByChain(chain);
      for (const token of tokens) {
        try {
          const balance = await service.getTokenBalance(address, token.symbol);
          balances.set(token.symbol, balance);
        } catch (error) {
          console.error(`Failed to get ${token.symbol} balance:`, error);
        }
      }
    }

    return balances;
  }

  /**
   * Future method: Bridge tokens between chains
   * Placeholder for future implementation
   */
  async bridgeToken(
    token: string,
    amount: bigint,
    fromChain: string,
    toChain: string,
    address: string
  ): Promise<any> {
    throw new Error('Token bridging not implemented yet');
  }

  /**
   * Future method: Get cross-chain transaction status
   * Placeholder for future implementation
   */
  async getCrossChainStatus(bridgeId: string): Promise<any> {
    throw new Error('Cross-chain status tracking not implemented yet');
  }
}

// Export singleton instance
export const blockchainManager = BlockchainManager.getInstance();
