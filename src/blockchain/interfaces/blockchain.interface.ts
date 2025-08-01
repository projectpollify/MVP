// src/modules/blockchain/interfaces/blockchain.interface.ts

export interface WalletInfo {
  address: string;
  network: string;
  balance: bigint;
  stakeAddress?: string;
}

export interface TransactionResult {
  txHash: string;
  chain: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations?: number;
  timestamp: Date;
  fee?: bigint;
}

export interface TokenTransfer {
  token: string;
  amount: bigint;
  from: string;
  to: string;
  memo?: string;
}

export interface BlockchainRecord {
  type: 'poll_result' | 'moderation' | 'reputation' | 'source_verification' | 'governance';
  data: any;
  hash: string;
  timestamp: Date;
}

export interface TokenBalance {
  token: string;
  balance: bigint;
  formatted: string;
}

// Base interface that all blockchain services must implement
export interface IBlockchainService {
  // Chain identification
  getChainName(): string;
  isTestnet(): boolean;
  
  // Wallet operations
  verifyWalletSignature(message: string, signature: string, address: string): Promise<boolean>;
  getWalletInfo(address: string): Promise<WalletInfo>;
  
  // Token operations
  getTokenBalance(address: string, token: string): Promise<TokenBalance>;
  transferToken(transfer: TokenTransfer): Promise<TransactionResult>;
  
  // Record operations
  createRecord(record: BlockchainRecord): Promise<TransactionResult>;
  getRecord(txHash: string): Promise<BlockchainRecord | null>;
  
  // Transaction operations
  getTransaction(txHash: string): Promise<TransactionResult>;
  waitForConfirmation(txHash: string, confirmations?: number): Promise<TransactionResult>;
  
  // Utility
  estimateFee(operation: 'transfer' | 'record'): Promise<bigint>;
  isValidAddress(address: string): boolean;
}

// Multi-chain manager interface
export interface IBlockchainManager {
  getService(chain: string): IBlockchainService;
  getSupportedChains(): string[];
  getDefaultChain(): string;
}
