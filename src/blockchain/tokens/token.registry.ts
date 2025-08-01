// src/modules/blockchain/tokens/token.registry.ts

export interface TokenConfig {
  symbol: string;
  chain: string;
  type: 'governance' | 'appreciation' | 'utility' | 'nft';
  policyId?: string;
  assetName?: string;
  decimals: number;
  displayName: string;
  description: string;
  isActive: boolean;
  // Future fields
  bridgeContract?: string;
  nftMetadataStandard?: string;
  config?: any;
}

export interface TokenRegistryConfig {
  [key: string]: TokenConfig;
}

// Token configuration with future tokens commented out
export const TOKEN_CONFIG: TokenRegistryConfig = {
  PCO: {
    symbol: 'PCO',
    chain: 'cardano',
    type: 'governance',
    policyId: process.env.PCO_POLICY_ID || 'test_policy_id_pco',
    assetName: 'PollCoin',
    decimals: 6,
    displayName: 'Poll Coin',
    description: 'Governance token for Pollify platform',
    isActive: true
  },
  GRATIUM: {
    symbol: 'GRATIUM',
    chain: 'cardano',
    type: 'appreciation',
    policyId: process.env.GRATIUM_POLICY_ID || 'test_policy_id_gratium',
    assetName: 'Gratium',
    decimals: 0,
    displayName: 'Gratium',
    description: 'Appreciation token for content creators',
    isActive: true
  }
  // Future tokens - uncomment when ready
  // COSMOFLUX: {
  //   symbol: 'COSMOFLUX',
  //   chain: 'cardano',
  //   type: 'utility',
  //   policyId: process.env.COSMOFLUX_POLICY_ID,
  //   assetName: 'Cosmoflux',
  //   decimals: 6,
  //   displayName: 'Cosmoflux',
  //   description: 'Cosmic energy token',
  //   isActive: false
  // },
  // THOUGHT: {
  //   symbol: 'THOUGHT',
  //   chain: 'cardano',
  //   type: 'utility',
  //   policyId: process.env.THOUGHT_POLICY_ID,
  //   assetName: 'Thought',
  //   decimals: 8,
  //   displayName: 'Thought Token',
  //   description: 'Intellectual contribution token',
  //   isActive: false
  // }
};

export class TokenRegistry {
  private static instance: TokenRegistry;
  private tokens: TokenRegistryConfig;

  private constructor() {
    this.tokens = { ...TOKEN_CONFIG };
  }

  static getInstance(): TokenRegistry {
    if (!TokenRegistry.instance) {
      TokenRegistry.instance = new TokenRegistry();
    }
    return TokenRegistry.instance;
  }

  // Get token configuration
  getToken(symbol: string): TokenConfig | undefined {
    return this.tokens[symbol.toUpperCase()];
  }

  // Get all active tokens
  getActiveTokens(): TokenConfig[] {
    return Object.values(this.tokens).filter(token => token.isActive);
  }

  // Get tokens by chain
  getTokensByChain(chain: string): TokenConfig[] {
    return Object.values(this.tokens).filter(
      token => token.chain === chain && token.isActive
    );
  }

  // Get tokens by type
  getTokensByType(type: TokenConfig['type']): TokenConfig[] {
    return Object.values(this.tokens).filter(
      token => token.type === type && token.isActive
    );
  }

  // Register new token (for future expansion)
  registerToken(symbol: string, config: TokenConfig): void {
    if (this.tokens[symbol.toUpperCase()]) {
      throw new Error(`Token ${symbol} already registered`);
    }
    this.tokens[symbol.toUpperCase()] = config;
  }

  // Update token configuration
  updateToken(symbol: string, updates: Partial<TokenConfig>): void {
    const token = this.tokens[symbol.toUpperCase()];
    if (!token) {
      throw new Error(`Token ${symbol} not found`);
    }
    this.tokens[symbol.toUpperCase()] = { ...token, ...updates };
  }

  // Check if token exists and is active
  isTokenActive(symbol: string): boolean {
    const token = this.tokens[symbol.toUpperCase()];
    return token ? token.isActive : false;
  }

  // Get Cardano asset ID (policyId + assetName)
  getCardanoAssetId(symbol: string): string | undefined {
    const token = this.tokens[symbol.toUpperCase()];
    if (!token || token.chain !== 'cardano') return undefined;
    
    if (!token.policyId || !token.assetName) return undefined;
    
    // Convert asset name to hex
    const assetNameHex = Buffer.from(token.assetName).toString('hex');
    return `${token.policyId}${assetNameHex}`;
  }

  // Format token amount for display
  formatAmount(symbol: string, amount: bigint | number): string {
    const token = this.tokens[symbol.toUpperCase()];
    if (!token) throw new Error(`Token ${symbol} not found`);
    
    const divisor = Math.pow(10, token.decimals);
    const formatted = Number(amount) / divisor;
    
    return formatted.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: token.decimals
    });
  }

  // Parse token amount from user input
  parseAmount(symbol: string, amount: string | number): bigint {
    const token = this.tokens[symbol.toUpperCase()];
    if (!token) throw new Error(`Token ${symbol} not found`);
    
    const multiplier = Math.pow(10, token.decimals);
    const parsed = Number(amount) * multiplier;
    
    if (isNaN(parsed)) {
      throw new Error(`Invalid amount: ${amount}`);
    }
    
    return BigInt(Math.floor(parsed));
  }
}

// Export singleton instance
export const tokenRegistry = TokenRegistry.getInstance();
