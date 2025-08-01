// src/modules/blockchain/blockchain.routes.ts

import { Router, Request, Response } from 'express';
import { walletAuth } from '../auth/wallet.auth';
import { blockchainManager } from './blockchain.manager';
import { tokenRegistry } from './tokens/token.registry';
import { recordService } from './services/record.service';
import { faucetService } from './services/faucet.service';
import { eventEmitter } from '../../shared/events';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route GET /api/v1/blockchain/tokens
 * @desc Get all supported tokens
 * @access Public
 */
router.get('/tokens', async (req: Request, res: Response) => {
  try {
    const { chain, type, active } = req.query;
    
    let tokens = tokenRegistry.getActiveTokens();
    
    // Filter by chain if specified
    if (chain && typeof chain === 'string') {
      tokens = tokens.filter(t => t.chain === chain);
    }
    
    // Filter by type if specified
    if (type && typeof type === 'string') {
      tokens = tokens.filter(t => t.type === type);
    }
    
    // Filter by active status if specified
    if (active !== undefined) {
      const isActive = active === 'true';
      tokens = isActive ? tokens : [];
    }

    res.json({
      success: true,
      data: { tokens }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get tokens'
    });
  }
});

/**
 * @route GET /api/v1/blockchain/balance/:address
 * @desc Get token balances for an address
 * @access Public
 */
router.get('/balance/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { token, chain } = req.query;

    // Validate address
    const detectedChain = chain || blockchainManager.detectChainFromAddress(address);
    if (!detectedChain) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address or chain not specified'
      });
    }

    const service = blockchainManager.getService(detectedChain as string);

    if (token) {
      // Get specific token balance
      const balance = await service.getTokenBalance(address, token as string);
      res.json({
        success: true,
        data: { 
          address,
          chain: detectedChain,
          balances: [balance]
        }
      });
    } else {
      // Get all token balances
      const tokens = tokenRegistry.getTokensByChain(detectedChain as string);
      const balances = await Promise.all(
        tokens.map(t => service.getTokenBalance(address, t.symbol))
      );

      res.json({
        success: true,
        data: { 
          address,
          chain: detectedChain,
          balances 
        }
      });
    }
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get balance'
    });
  }
});

/**
 * @route POST /api/v1/blockchain/transfer
 * @desc Transfer tokens
 * @access Private
 */
router.post('/transfer', walletAuth.authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { token, amount, to, chain, memo } = req.body;

    // Validate inputs
    if (!token || !amount || !to) {
      return res.status(400).json({
        success: false,
        error: 'Token, amount, and recipient address required'
      });
    }

    // Get token config
    const tokenConfig = tokenRegistry.getToken(token);
    if (!tokenConfig) {
      return res.status(400).json({
        success: false,
        error: `Token ${token} not supported`
      });
    }

    // Get blockchain service
    const service = blockchainManager.getService(chain || tokenConfig.chain);

    // Validate recipient address
    if (!service.isValidAddress(to)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid recipient address'
      });
    }

    // Parse amount
    const parsedAmount = tokenRegistry.parseAmount(token, amount);

    // Create transfer
    const result = await service.transferToken({
      token,
      amount: parsedAmount,
      from: user.walletAddress,
      to,
      memo
    });

    // Record transaction in database
    await prisma.token_transactions.create({
      data: {
        from_wallet: user.walletAddress,
        to_wallet: to,
        amount: parsedAmount,
        tx_hash: result.txHash,
        chain: tokenConfig.chain,
        token_symbol: token,
        token_type: 'fungible',
        metadata: memo ? { memo } : undefined
      }
    });

    // Emit transfer event
    eventEmitter.emit('token:transferred', {
      token,
      amount: parsedAmount.toString(),
      from: user.walletAddress,
      to,
      txHash: result.txHash,
      chain: tokenConfig.chain,
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: {
        transaction: result,
        amount: tokenRegistry.formatAmount(token, parsedAmount)
      }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Transfer failed'
    });
  }
});

/**
 * @route POST /api/v1/blockchain/record
 * @desc Create immutable record on blockchain
 * @access Private
 */
router.post('/record', walletAuth.authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { type, data, chain } = req.body;

    // Validate record type
    const validTypes = ['poll_result', 'moderation', 'reputation', 'source_verification', 'governance'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid record type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Create record
    const result = await recordService.createRecord({
      type,
      data,
      createdBy: user.userId,
      chain: chain || 'cardano'
    });

    // Emit record event
    eventEmitter.emit('record:created', {
      recordId: result.id,
      type,
      txHash: result.txHash,
      chain: result.chain,
      createdBy: user.userId,
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: { record: result }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create record'
    });
  }
});

/**
 * @route GET /api/v1/blockchain/record/:txHash
 * @desc Get blockchain record by transaction hash
 * @access Public
 */
router.get('/record/:txHash', async (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;

    const record = await recordService.getRecord(txHash);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Record not found'
      });
    }

    res.json({
      success: true,
      data: { record }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get record'
    });
  }
});

/**
 * @route GET /api/v1/blockchain/records
 * @desc Get blockchain records with filters
 * @access Public
 */
router.get('/records', async (req: Request, res: Response) => {
  try {
    const { type, createdBy, status, limit = 20, offset = 0 } = req.query;

    const records = await recordService.queryRecords({
      type: type as string,
      createdBy: createdBy as string,
      status: status as string,
      limit: Number(limit),
      offset: Number(offset)
    });

    res.json({
      success: true,
      data: { 
        records,
        pagination: {
          limit: Number(limit),
          offset: Number(offset)
        }
      }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to query records'
    });
  }
});

/**
 * @route POST /api/v1/blockchain/faucet/claim
 * @desc Claim tokens from faucet
 * @access Private
 */
router.post('/faucet/claim', walletAuth.authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { token } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'] || '';

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token symbol required'
      });
    }

    // Check if token has faucet enabled
    const tokenConfig = tokenRegistry.getToken(token);
    if (!tokenConfig || !tokenConfig.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Token not available for faucet claims'
      });
    }

    // Process faucet claim
    const claim = await faucetService.claimTokens({
      walletAddress: user.walletAddress,
      token,
      ipAddress,
      userAgent
    });

    // Emit faucet claim event
    eventEmitter.emit('faucet:claimed', {
      walletAddress: user.walletAddress,
      token,
      amount: claim.amount,
      txHash: claim.txHash,
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: {
        claim: {
          ...claim,
          formattedAmount: tokenRegistry.formatAmount(token, claim.amount)
        },
        nextClaimTime: claim.nextClaimTime
      }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Faucet claim failed'
    });
  }
});

/**
 * @route GET /api/v1/blockchain/faucet/status/:address
 * @desc Check faucet claim status for address
 * @access Public
 */
router.get('/faucet/status/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token symbol required'
      });
    }

    const status = await faucetService.getClaimStatus(address, token as string);

    res.json({
      success: true,
      data: { status }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get faucet status'
    });
  }
});

/**
 * @route GET /api/v1/blockchain/transaction/:txHash
 * @desc Get transaction details
 * @access Public
 */
router.get('/transaction/:txHash', async (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;
    const { chain } = req.query;

    // Try to find transaction in database first
    const dbTx = await prisma.token_transactions.findUnique({
      where: { tx_hash: txHash }
    });

    const service = blockchainManager.getService(
      chain as string || dbTx?.chain || 'cardano'
    );

    const transaction = await service.getTransaction(txHash);

    res.json({
      success: true,
      data: { 
        transaction,
        dbRecord: dbTx 
      }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get transaction'
    });
  }
});

/**
 * @route POST /api/v1/blockchain/verify-record
 * @desc Verify a record exists on blockchain
 * @access Public
 */
router.post('/verify-record', async (req: Request, res: Response) => {
  try {
    const { txHash, dataHash } = req.body;

    if (!txHash || !dataHash) {
      return res.status(400).json({
        success: false,
        error: 'Transaction hash and data hash required'
      });
    }

    const isValid = await recordService.verifyRecord(txHash, dataHash);

    res.json({
      success: true,
      data: { 
        valid: isValid,
        txHash,
        dataHash
      }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Verification failed'
    });
  }
});

/**
 * @route GET /api/v1/blockchain/fees
 * @desc Get estimated transaction fees
 * @access Public
 */
router.get('/fees', async (req: Request, res: Response) => {
  try {
    const { operation = 'transfer', chain = 'cardano' } = req.query;

    const service = blockchainManager.getService(chain as string);
    const fee = await service.estimateFee(operation as 'transfer' | 'record');

    res.json({
      success: true,
      data: { 
        chain,
        operation,
        fee: fee.toString(),
        formatted: `${Number(fee) / 1000000} ADA` // For Cardano
      }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to estimate fees'
    });
  }
});

export default router;
