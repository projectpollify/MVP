// src/modules/auth/wallet.auth.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { cardanoService } from '../blockchain/services/cardano.service';

const prisma = new PrismaClient();

export interface WalletAuthRequest {
  address: string;
  signature?: string;
  nonce?: string;
  chain?: string;
}

export interface AuthToken {
  userId: string;
  walletAddress: string;
  chain: string;
}

export class WalletAuthService {
  private static readonly NONCE_EXPIRY = 5 * 60 * 1000; // 5 minutes
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
  private static readonly JWT_EXPIRY = '7d';

  // Store nonces temporarily (in production, use Redis)
  private static nonces = new Map<string, { nonce: string; timestamp: number }>();

  /**
   * Step 1: Generate nonce for wallet to sign
   */
  static async generateNonce(address: string): Promise<string> {
    // Validate address
    if (!cardanoService.isValidAddress(address)) {
      throw new Error('Invalid wallet address');
    }

    // Generate random nonce
    const nonce = randomBytes(32).toString('hex');
    
    // Store nonce with timestamp
    this.nonces.set(address, {
      nonce,
      timestamp: Date.now()
    });

    // Clean up old nonces
    this.cleanupNonces();

    return nonce;
  }

  /**
   * Step 2: Verify wallet signature and authenticate
   */
  static async verifyAndAuthenticate(
    address: string, 
    signature: string, 
    nonce: string,
    chain: string = 'cardano'
  ): Promise<{ token: string; user: any }> {
    // Retrieve stored nonce
    const storedNonceData = this.nonces.get(address);
    
    if (!storedNonceData) {
      throw new Error('Nonce not found or expired');
    }

    // Check nonce expiry
    if (Date.now() - storedNonceData.timestamp > this.NONCE_EXPIRY) {
      this.nonces.delete(address);
      throw new Error('Nonce expired');
    }

    // Verify nonce matches
    if (storedNonceData.nonce !== nonce) {
      throw new Error('Invalid nonce');
    }

    // Create message that was signed
    const message = this.createSignatureMessage(address, nonce);

    // Verify signature based on chain
    let isValid = false;
    if (chain === 'cardano') {
      isValid = await cardanoService.verifyWalletSignature(message, signature, address);
    } else {
      throw new Error(`Chain ${chain} not supported yet`);
    }

    if (!isValid) {
      throw new Error('Invalid signature');
    }

    // Remove used nonce
    this.nonces.delete(address);

    // Find or create user
    let user = await prisma.users.findUnique({
      where: { wallet_pub_key: address }
    });

    if (!user) {
      // Create new user
      user = await prisma.users.create({
        data: {
          wallet_pub_key: address,
          display_name: `User_${address.slice(-6)}`,
          mode: true
        }
      });
    }

    // Generate JWT token
    const tokenPayload: AuthToken = {
      userId: user.id,
      walletAddress: address,
      chain
    };

    const token = jwt.sign(tokenPayload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRY
    });

    return { token, user };
  }

  /**
   * Create the message to be signed
   */
  private static createSignatureMessage(address: string, nonce: string): string {
    return `Sign this message to authenticate with Pollify:\n\nWallet: ${address}\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`;
  }

  /**
   * Clean up expired nonces
   */
  private static cleanupNonces(): void {
    const now = Date.now();
    for (const [address, data] of this.nonces.entries()) {
      if (now - data.timestamp > this.NONCE_EXPIRY) {
        this.nonces.delete(address);
      }
    }
  }

  /**
   * Middleware to verify JWT token
   */
  static authenticateToken(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ 
        success: false, 
        error: 'No authentication token provided' 
      });
      return;
    }

    jwt.verify(token, WalletAuthService.JWT_SECRET, (err, decoded) => {
      if (err) {
        res.status(403).json({ 
          success: false, 
          error: 'Invalid or expired token' 
        });
        return;
      }

      // Add user info to request
      (req as any).user = decoded as AuthToken;
      next();
    });
  }

  /**
   * Get user from token
   */
  static async getUserFromToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as AuthToken;
      
      const user = await prisma.users.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}

// Export for use in routes
export const walletAuth = WalletAuthService;
