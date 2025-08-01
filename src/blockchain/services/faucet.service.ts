// src/modules/blockchain/services/faucet.service.ts

import { PrismaClient } from '@prisma/client';
import { blockchainManager } from '../blockchain.manager';
import { tokenRegistry } from '../tokens/token.registry';

const prisma = new PrismaClient();

export interface FaucetClaimRequest {
  walletAddress: string;
  token: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface FaucetClaimResult {
  id: string;
  walletAddress: string;
  token: string;
  amount: bigint;
  txHash: string;
  claimedAt: Date;
  nextClaimTime: Date;
}

export interface FaucetStatus {
  canClaim: boolean;
  lastClaim?: Date;
  nextClaimTime?: Date;
  claimAmount: string;
  cooldownHours: number;
}

class FaucetService {
  private readonly DEFAULT_AMOUNTS: Record<string, bigint> = {
    'tPCO': BigInt('100000000'), // 100 PCO (6 decimals)
    'tGRATIUM': BigInt('100'), // 100 GRATIUM (0 decimals)
    'PCO': BigInt('100000000'), // For testnet
    'GRATIUM': BigInt('100') // For testnet
  };

  private readonly COOLDOWN_HOURS = 24; // 24 hours between claims

  /**
   * Claim tokens from faucet
   */
  async claimTokens(request: FaucetClaimRequest): Promise<FaucetClaimResult> {
    const { walletAddress, token, ipAddress, userAgent } = request;

    // Validate token
    const tokenConfig = tokenRegistry.getToken(token);
    if (!tokenConfig || !tokenConfig.isActive) {
      throw new Error(`Token ${token} not available for faucet claims`);
    }

    // Check if on testnet
    const service = blockchainManager.getService(tokenConfig.chain);
    if (!service.isTestnet() && !token.startsWith('t')) {
      throw new Error('Faucet only available on testnet');
    }

    // Check cooldown
    await this.checkCooldown(walletAddress, token);

    // Get faucet amount
    const amount = this.getFaucetAmount(token);

    // Create mock transaction (in production, this would mint/transfer from faucet wallet)
    const txHash = await this.processFaucetTransaction(walletAddress, token, amount);

    // Record claim
    const claim = await prisma.faucet_claims.create({
      data: {
        wallet_address: walletAddress,
        token_symbol: token,
        amount,
        tx_hash: txHash,
        chain: tokenConfig.chain,
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });

    // Calculate next claim time
    const nextClaimTime = new Date(claim.claimed_at);
    nextClaimTime.setHours(nextClaimTime.getHours() + this.COOLDOWN_HOURS);

    return {
      id: claim.id,
      walletAddress: claim.wallet_address,
      token: claim.token_symbol,
      amount: claim.amount,
      txHash: claim.tx_hash || '',
      claimedAt: claim.claimed_at,
      nextClaimTime
    };
  }

  /**
   * Get faucet claim status
   */
  async getClaimStatus(walletAddress: string, token: string): Promise<FaucetStatus> {
    // Get token config
    const tokenConfig = tokenRegistry.getToken(token);
    if (!tokenConfig) {
      throw new Error(`Token ${token} not found`);
    }

    // Get last claim
    const lastClaim = await this.getLastClaim(walletAddress, token);

    // Calculate status
    let canClaim = true;
    let nextClaimTime: Date | undefined;

    if (lastClaim) {
      const hoursSinceLastClaim = 
        (Date.now() - lastClaim.claimed_at.getTime()) / (1000 * 60 * 60);
      
      canClaim = hoursSinceLastClaim >= this.COOLDOWN_HOURS;
      
      if (!canClaim) {
        nextClaimTime = new Date(lastClaim.claimed_at);
        nextClaimTime.setHours(nextClaimTime.getHours() + this.COOLDOWN_HOURS);
      }
    }

    const amount = this.getFaucetAmount(token);

    return {
      canClaim,
      lastClaim: lastClaim?.claimed_at,
      nextClaimTime,
      claimAmount: tokenRegistry.formatAmount(token, amount),
      cooldownHours: this.COOLDOWN_HOURS
    };
  }

  /**
   * Get faucet statistics
   */
  async getFaucetStats(token?: string): Promise<any> {
    const where = token ? { token_symbol: token } : {};

    const [totalClaims, uniqueUsers, totalDistributed] = await Promise.all([
      // Total claims
      prisma.faucet_claims.count({ where }),
      
      // Unique users
      prisma.faucet_claims.findMany({
        where,
        distinct: ['wallet_address'],
        select: { wallet_address: true }
      }).then(r => r.length),
      
      // Total distributed (by token)
      prisma.faucet_claims.groupBy({
        by: ['token_symbol'],
        where,
        _sum: { amount: true }
      })
    ]);

    return {
      totalClaims,
      uniqueUsers,
      totalDistributed: totalDistributed.map(t => ({
        token: t.token_symbol,
        amount: t._sum.amount?.toString() || '0',
        formatted: tokenRegistry.formatAmount(
          t.token_symbol, 
          BigInt(t._sum.amount || 0)
        )
      }))
    };
  }

  /**
   * Check if user can claim (cooldown period)
   */
  private async checkCooldown(walletAddress: string, token: string): Promise<void> {
    const lastClaim = await this.getLastClaim(walletAddress, token);

    if (lastClaim) {
      const hoursSinceLastClaim = 
        (Date.now() - lastClaim.claimed_at.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastClaim < this.COOLDOWN_HOURS) {
        const hoursRemaining = Math.ceil(this.COOLDOWN_HOURS - hoursSinceLastClaim);
        throw new Error(
          `Please wait ${hoursRemaining} more hours before claiming again`
        );
      }
    }
  }

  /**
   * Get last claim for wallet/token
   */
  private async getLastClaim(walletAddress: string, token: string): Promise<any> {
    return prisma.faucet_claims.findFirst({
      where: {
        wallet_address: walletAddress,
        token_symbol: token
      },
      orderBy: { claimed_at: 'desc' }
    });
  }

  /**
   * Get faucet amount for token
   */
  private getFaucetAmount(token: string): bigint {
    // Check token config for custom amount
    const tokenConfig = tokenRegistry.getToken(token);
    if (tokenConfig && tokenConfig.config) {
      const config = tokenConfig.config as any;
      if (config.faucet_amount) {
        return BigInt(config.faucet_amount);
      }
    }

    // Use default amount
    return this.DEFAULT_AMOUNTS[token] || BigInt('100000000');
  }

  /**
   * Process faucet transaction
   * In production, this would mint tokens or transfer from faucet wallet
   */
  private async processFaucetTransaction(
    recipient: string,
    token: string,
    amount: bigint
  ): Promise<string> {
    try {
      const tokenConfig = tokenRegistry.getToken(token);
      if (!tokenConfig) {
        throw new Error(`Token ${token} not found`);
      }

      const service = blockchainManager.getService(tokenConfig.chain);

      // In production, this would:
      // 1. Use a faucet wallet with pre-minted tokens
      // 2. Or mint new tokens if minting is enabled
      // 3. Transfer to recipient

      // For MVP, simulate the transaction
      const result = await service.transferToken({
        token,
        amount,
        from: 'faucet_wallet_address', // Would be actual faucet wallet
        to: recipient,
        memo: 'Faucet claim'
      });

      return result.txHash;
    } catch (error) {
      // For MVP, return mock transaction hash
      console.log('Faucet transaction simulation:', { recipient, token, amount });
      return `faucet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Admin functions
   */
  
  /**
   * Update faucet configuration
   */
  async updateFaucetConfig(
    token: string, 
    config: {
      amount?: string;
      cooldownHours?: number;
      enabled?: boolean;
    }
  ): Promise<void> {
    const tokenConfig = tokenRegistry.getToken(token);
    if (!tokenConfig) {
      throw new Error(`Token ${token} not found`);
    }

    const updates: any = {};
    if (config.amount !== undefined) {
      updates['config.faucet_amount'] = config.amount;
    }
    if (config.cooldownHours !== undefined) {
      updates['config.faucet_cooldown_hours'] = config.cooldownHours;
    }
    if (config.enabled !== undefined) {
      updates['config.faucet_enabled'] = config.enabled;
    }

    // Update token registry (in production, this would update database)
    tokenRegistry.updateToken(token, { config: { ...tokenConfig.config, ...updates } });
  }

  /**
   * Blacklist address from faucet
   */
  async blacklistAddress(address: string, reason: string): Promise<void> {
    // In production, maintain a blacklist table
    console.log('Blacklisting address:', { address, reason });
  }

  /**
   * Get recent claims for monitoring
   */
  async getRecentClaims(limit: number = 50): Promise<any[]> {
    const claims = await prisma.faucet_claims.findMany({
      take: limit,
      orderBy: { claimed_at: 'desc' },
      select: {
        id: true,
        wallet_address: true,
        token_symbol: true,
        amount: true,
        tx_hash: true,
        claimed_at: true,
        ip_address: true
      }
    });

    return claims.map(claim => ({
      ...claim,
      amount: claim.amount.toString(),
      formatted_amount: tokenRegistry.formatAmount(
        claim.token_symbol, 
        claim.amount
      )
    }));
  }
}

// Export singleton instance
export const faucetService = new FaucetService();
