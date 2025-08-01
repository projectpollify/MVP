// src/modules/auth/auth.routes.ts

import { Router, Request, Response } from 'express';
import { walletAuth } from './wallet.auth';
import { eventEmitter } from '../../shared/events';

const router = Router();

/**
 * @route GET /api/v1/auth/nonce/:address
 * @desc Generate nonce for wallet signature
 * @access Public
 */
router.get('/nonce/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address required'
      });
    }

    // Generate nonce for signing
    const nonce = await walletAuth.generateNonce(address);

    res.json({
      success: true,
      data: {
        nonce,
        message: `Sign this message to authenticate with Pollify:\n\nWallet: ${address}\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`,
        expiresIn: 300 // 5 minutes
      }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to generate nonce'
    });
  }
});

/**
 * @route POST /api/v1/auth/verify
 * @desc Verify wallet signature and authenticate
 * @access Public
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { address, signature, nonce, chain = 'cardano' } = req.body;

    // Validate required fields
    if (!address || !signature || !nonce) {
      return res.status(400).json({
        success: false,
        error: 'Address, signature, and nonce required'
      });
    }

    // Verify signature and authenticate
    const { token, user } = await walletAuth.verifyAndAuthenticate(
      address,
      signature,
      nonce,
      chain
    );

    // Emit authentication event
    eventEmitter.emit('auth:user_authenticated', {
      userId: user.id,
      walletAddress: address,
      chain,
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          walletAddress: user.wallet_pub_key,
          displayName: user.display_name,
          mode: user.mode,
          pillarId: user.pillar_id,
          createdAt: user.created_at
        }
      }
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: error.message || 'Authentication failed'
    });
  }
});

/**
 * @route GET /api/v1/auth/me
 * @desc Get current authenticated user
 * @access Private
 */
router.get('/me', walletAuth.authenticateToken, async (req: Request, res: Response) => {
  try {
    const userToken = (req as any).user;
    
    const user = await walletAuth.getUserFromToken(
      req.headers.authorization?.split(' ')[1] || ''
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          walletAddress: user.wallet_pub_key,
          displayName: user.display_name,
          mode: user.mode,
          pillarId: user.pillar_id,
          createdAt: user.created_at
        },
        chain: userToken.chain
      }
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: error.message || 'Failed to get user'
    });
  }
});

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout user (client should discard token)
 * @access Private
 */
router.post('/logout', walletAuth.authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Emit logout event
    eventEmitter.emit('auth:user_logout', {
      userId: user.userId,
      walletAddress: user.walletAddress,
      timestamp: new Date()
    });

    // In a production system, you might want to:
    // - Add token to a blacklist
    // - Clear any server-side sessions
    // - Update last activity timestamp

    res.json({
      success: true,
      data: {
        message: 'Logged out successfully'
      }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Logout failed'
    });
  }
});

/**
 * @route PUT /api/v1/auth/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/profile', walletAuth.authenticateToken, async (req: Request, res: Response) => {
  try {
    const userToken = (req as any).user;
    const { displayName, mode, pillarId } = req.body;

    // Build update object
    const updateData: any = {};
    if (displayName !== undefined) updateData.display_name = displayName;
    if (mode !== undefined) updateData.mode = mode;
    if (pillarId !== undefined) updateData.pillar_id = pillarId;

    // Update user in database
    const updatedUser = await prisma.users.update({
      where: { id: userToken.userId },
      data: updateData
    });

    // Emit profile update event
    eventEmitter.emit('auth:profile_updated', {
      userId: userToken.userId,
      updates: updateData,
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          walletAddress: updatedUser.wallet_pub_key,
          displayName: updatedUser.display_name,
          mode: updatedUser.mode,
          pillarId: updatedUser.pillar_id,
          createdAt: updatedUser.created_at
        }
      }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update profile'
    });
  }
});

/**
 * @route GET /api/v1/auth/check/:address
 * @desc Check if wallet address is registered
 * @access Public
 */
router.get('/check/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const user = await prisma.users.findUnique({
      where: { wallet_pub_key: address },
      select: { id: true, display_name: true, created_at: true }
    });

    res.json({
      success: true,
      data: {
        exists: !!user,
        user: user ? {
          displayName: user.display_name,
          memberSince: user.created_at
        } : null
      }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to check address'
    });
  }
});

// Import Prisma client
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export default router;
