// src/modules/blockchain/services/record.service.ts

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { blockchainManager } from '../blockchain.manager';
import { BlockchainRecord } from '../interfaces/blockchain.interface';

const prisma = new PrismaClient();

export interface CreateRecordOptions {
  type: 'poll_result' | 'moderation' | 'reputation' | 'source_verification' | 'governance';
  data: any;
  createdBy: string;
  chain?: string;
}

export interface QueryRecordsOptions {
  type?: string;
  createdBy?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface RecordWithMetadata {
  id: string;
  txHash: string;
  chain: string;
  type: string;
  dataHash: string;
  data: any;
  createdBy: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
  confirmations: number;
  status: string;
}

class RecordService {
  /**
   * Create an immutable record on the blockchain
   */
  async createRecord(options: CreateRecordOptions): Promise<RecordWithMetadata> {
    const { type, data, createdBy, chain = 'cardano' } = options;

    // Validate data
    this.validateRecordData(type, data);

    // Create data hash
    const dataHash = this.hashData(data);

    // Get blockchain service
    const service = blockchainManager.getService(chain);

    // Create blockchain record
    const blockchainRecord: BlockchainRecord = {
      type,
      data,
      hash: dataHash,
      timestamp: new Date()
    };

    // Submit to blockchain
    const txResult = await service.createRecord(blockchainRecord);

    // Store in database
    const dbRecord = await prisma.blockchain_records.create({
      data: {
        tx_hash: txResult.txHash,
        chain,
        record_type: type,
        data_hash: dataHash,
        data,
        created_by: createdBy,
        status: txResult.status,
        confirmations: txResult.confirmations || 0
      }
    });

    // Start confirmation monitoring
    this.monitorConfirmation(txResult.txHash, chain);

    return this.formatRecord(dbRecord);
  }

  /**
   * Get a record by transaction hash
   */
  async getRecord(txHash: string): Promise<RecordWithMetadata | null> {
    const record = await prisma.blockchain_records.findUnique({
      where: { tx_hash: txHash }
    });

    if (!record) {
      return null;
    }

    return this.formatRecord(record);
  }

  /**
   * Query records with filters
   */
  async queryRecords(options: QueryRecordsOptions): Promise<RecordWithMetadata[]> {
    const { type, createdBy, status, limit = 20, offset = 0 } = options;

    const where: any = {};
    if (type) where.record_type = type;
    if (createdBy) where.created_by = createdBy;
    if (status) where.status = status;

    const records = await prisma.blockchain_records.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { created_at: 'desc' }
    });

    return records.map(r => this.formatRecord(r));
  }

  /**
   * Verify a record's integrity
   */
  async verifyRecord(txHash: string, dataHash: string): Promise<boolean> {
    try {
      // Get record from database
      const dbRecord = await prisma.blockchain_records.findUnique({
        where: { tx_hash: txHash }
      });

      if (!dbRecord) {
        return false;
      }

      // Verify data hash matches
      if (dbRecord.data_hash !== dataHash) {
        return false;
      }

      // Verify current data still hashes to same value
      const currentHash = this.hashData(dbRecord.data);
      if (currentHash !== dataHash) {
        return false;
      }

      // Get blockchain service and verify on-chain
      const service = blockchainManager.getService(dbRecord.chain);
      const chainRecord = await service.getRecord(txHash);

      if (!chainRecord) {
        return false;
      }

      return chainRecord.hash === dataHash;
    } catch (error) {
      console.error('Record verification failed:', error);
      return false;
    }
  }

  /**
   * Get records by type for a specific entity
   */
  async getEntityRecords(
    entityId: string, 
    recordType: string,
    limit: number = 10
  ): Promise<RecordWithMetadata[]> {
    const records = await prisma.blockchain_records.findMany({
      where: {
        record_type: recordType,
        data: {
          path: ['entityId'],
          equals: entityId
        },
        status: 'confirmed'
      },
      take: limit,
      orderBy: { created_at: 'desc' }
    });

    return records.map(r => this.formatRecord(r));
  }

  /**
   * Create a hash of the data
   */
  private hashData(data: any): string {
    const serialized = JSON.stringify(data, Object.keys(data).sort());
    return createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Validate record data based on type
   */
  private validateRecordData(type: string, data: any): void {
    switch (type) {
      case 'poll_result':
        if (!data.pollId || !data.results || !data.totalVotes) {
          throw new Error('Poll result must include pollId, results, and totalVotes');
        }
        break;

      case 'moderation':
        if (!data.action || !data.targetId || !data.moderatorId) {
          throw new Error('Moderation record must include action, targetId, and moderatorId');
        }
        break;

      case 'reputation':
        if (!data.userId || data.change === undefined || !data.reason) {
          throw new Error('Reputation record must include userId, change amount, and reason');
        }
        break;

      case 'source_verification':
        if (!data.sourceId || data.score === undefined || !data.verifierId) {
          throw new Error('Source verification must include sourceId, score, and verifierId');
        }
        break;

      case 'governance':
        if (!data.proposalId || !data.decision || !data.votes) {
          throw new Error('Governance record must include proposalId, decision, and votes');
        }
        break;

      default:
        throw new Error(`Unknown record type: ${type}`);
    }
  }

  /**
   * Monitor transaction confirmation
   */
  private async monitorConfirmation(txHash: string, chain: string): Promise<void> {
    try {
      const service = blockchainManager.getService(chain);
      
      // Wait for confirmation in background
      setTimeout(async () => {
        try {
          const confirmed = await service.waitForConfirmation(txHash, 1);
          
          // Update database record
          await prisma.blockchain_records.update({
            where: { tx_hash: txHash },
            data: {
              status: 'confirmed',
              confirmations: confirmed.confirmations || 1,
              confirmed_at: new Date()
            }
          });
        } catch (error) {
          console.error(`Failed to confirm transaction ${txHash}:`, error);
          
          // Mark as failed after timeout
          await prisma.blockchain_records.update({
            where: { tx_hash: txHash },
            data: { status: 'failed' }
          });
        }
      }, 5000); // Start monitoring after 5 seconds
    } catch (error) {
      console.error('Confirmation monitoring failed:', error);
    }
  }

  /**
   * Format database record for API response
   */
  private formatRecord(record: any): RecordWithMetadata {
    return {
      id: record.id,
      txHash: record.tx_hash,
      chain: record.chain,
      type: record.record_type,
      dataHash: record.data_hash,
      data: record.data,
      createdBy: record.created_by,
      createdAt: record.created_at,
      confirmedAt: record.confirmed_at,
      confirmations: record.confirmations,
      status: record.status
    };
  }

  /**
   * Create specific record types with helper methods
   */
  async createPollResult(
    pollId: string,
    results: any,
    totalVotes: number,
    createdBy: string
  ): Promise<RecordWithMetadata> {
    return this.createRecord({
      type: 'poll_result',
      data: {
        pollId,
        results,
        totalVotes,
        timestamp: new Date().toISOString()
      },
      createdBy
    });
  }

  async createModerationRecord(
    action: string,
    targetId: string,
    targetType: string,
    moderatorId: string,
    reason: string
  ): Promise<RecordWithMetadata> {
    return this.createRecord({
      type: 'moderation',
      data: {
        action,
        targetId,
        targetType,
        moderatorId,
        reason,
        timestamp: new Date().toISOString()
      },
      createdBy: moderatorId
    });
  }

  async createReputationChange(
    userId: string,
    change: number,
    reason: string,
    createdBy: string
  ): Promise<RecordWithMetadata> {
    return this.createRecord({
      type: 'reputation',
      data: {
        userId,
        change,
        reason,
        timestamp: new Date().toISOString()
      },
      createdBy
    });
  }

  async createSourceVerification(
    sourceId: string,
    score: number,
    verifierId: string,
    details: any
  ): Promise<RecordWithMetadata> {
    return this.createRecord({
      type: 'source_verification',
      data: {
        sourceId,
        score,
        verifierId,
        details,
        timestamp: new Date().toISOString()
      },
      createdBy: verifierId
    });
  }

  async createGovernanceDecision(
    proposalId: string,
    decision: string,
    votes: any,
    executorId: string
  ): Promise<RecordWithMetadata> {
    return this.createRecord({
      type: 'governance',
      data: {
        proposalId,
        decision,
        votes,
        executedBy: executorId,
        timestamp: new Date().toISOString()
      },
      createdBy: executorId
    });
  }
}

// Export singleton instance
export const recordService = new RecordService();
