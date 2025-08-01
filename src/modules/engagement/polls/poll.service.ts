import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import { EventEmitter } from 'events';
import { 
  Poll, 
  PollOption, 
  PollVote, 
  CreatePollRequest, 
  PollWithOptions,
  PollResults 
} from './poll.types';

export class PollService {
  private db: Pool;
  private eventEmitter: EventEmitter;
  private blockchainService: any; // Will be injected from Module 4
  private tokenRegistry: any; // Will be injected from Module 4

  constructor(db: Pool, eventEmitter: EventEmitter, blockchainService: any, tokenRegistry: any) {
    this.db = db;
    this.eventEmitter = eventEmitter;
    this.blockchainService = blockchainService;
    this.tokenRegistry = tokenRegistry;
  }

  /**
   * Create a new poll with PCO fee
   */
  async createPoll(
    userId: string, 
    walletAddress: string, 
    request: CreatePollRequest
  ): Promise<Poll> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Step 1: Charge 1 PCO fee
      const pcoAmount = this.tokenRegistry.parseAmount('PCO', 1);
      const feeTransfer = await this.blockchainService.transferToken({
        token: 'PCO',
        amount: pcoAmount,
        from: walletAddress,
        to: process.env.PLATFORM_WALLET_ADDRESS, // Platform collects fees
        memo: 'Poll creation fee'
      });

      if (!feeTransfer.txHash) {
        throw new Error('Failed to process PCO fee');
      }

      // Step 2: Create poll record
      const pollId = uuidv4();
      const closesAt = new Date();
      closesAt.setHours(closesAt.getHours() + request.durationHours);

      const pollResult = await client.query(
        `INSERT INTO polls (
          id, post_id, question, poll_type, duration_hours, 
          closes_at, fee_tx_hash, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          pollId,
          request.postId,
          request.question,
          'single_choice',
          request.durationHours,
          closesAt,
          feeTransfer.txHash,
          userId
        ]
      );

      const poll = this.mapRowToPoll(pollResult.rows[0]);

      // Step 3: Create poll options
      const optionPromises = request.options.map((optionText, index) => 
        client.query(
          `INSERT INTO poll_options (
            id, poll_id, option_text, option_order
          ) VALUES ($1, $2, $3, $4)`,
          [uuidv4(), pollId, optionText, index]
        )
      );

      await Promise.all(optionPromises);

      await client.query('COMMIT');

      // Step 4: Emit event
      this.eventEmitter.emit('poll:created', {
        pollId: poll.id,
        postId: poll.postId,
        createdBy: poll.createdBy,
        feeTxHash: poll.feeTxHash
      });

      return poll;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Cast a vote on a poll
   */
  async vote(pollId: string, userId: string, optionId: string): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Check if poll exists and is open
      const pollResult = await client.query(
        'SELECT * FROM polls WHERE id = $1',
        [pollId]
      );

      if (pollResult.rows.length === 0) {
        throw new Error('Poll not found');
      }

      const poll = this.mapRowToPoll(pollResult.rows[0]);

      if (poll.isClosed) {
        throw new Error('Poll is closed');
      }

      if (new Date() > poll.closesAt) {
        throw new Error('Poll has expired');
      }

      // Check if user already voted
      const existingVote = await client.query(
        'SELECT * FROM poll_votes WHERE poll_id = $1 AND user_id = $2',
        [pollId, userId]
      );

      if (existingVote.rows.length > 0) {
        throw new Error('User has already voted');
      }

      // Record vote
      await client.query(
        'INSERT INTO poll_votes (poll_id, user_id, option_id) VALUES ($1, $2, $3)',
        [pollId, userId, optionId]
      );

      // Update vote counts
      await client.query(
        'UPDATE poll_options SET vote_count = vote_count + 1 WHERE id = $1',
        [optionId]
      );

      await client.query(
        'UPDATE polls SET total_votes = total_votes + 1 WHERE id = $1',
        [pollId]
      );

      await client.query('COMMIT');

      // Emit vote event
      this.eventEmitter.emit('poll:voted', {
        pollId,
        userId,
        optionId
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get poll with options and user's vote
   */
  async getPoll(pollId: string, userId?: string): Promise<PollWithOptions> {
    // Get poll
    const pollResult = await this.db.query(
      'SELECT * FROM polls WHERE id = $1',
      [pollId]
    );

    if (pollResult.rows.length === 0) {
      throw new Error('Poll not found');
    }

    const poll = this.mapRowToPoll(pollResult.rows[0]);

    // Get options
    const optionsResult = await this.db.query(
      'SELECT * FROM poll_options WHERE poll_id = $1 ORDER BY option_order',
      [pollId]
    );

    const options = optionsResult.rows.map(this.mapRowToPollOption);

    // Get user's vote if userId provided
    let userVote: PollVote | undefined;
    if (userId) {
      const voteResult = await this.db.query(
        'SELECT * FROM poll_votes WHERE poll_id = $1 AND user_id = $2',
        [pollId, userId]
      );

      if (voteResult.rows.length > 0) {
        userVote = this.mapRowToPollVote(voteResult.rows[0]);
      }
    }

    return {
      ...poll,
      options,
      userVote
    };
  }

  /**
   * Close expired polls and record results on blockchain
   */
  async closeExpiredPolls(): Promise<void> {
    // Find all expired, unclosed polls
    const expiredPolls = await this.db.query(
      `SELECT * FROM polls 
       WHERE is_closed = false 
       AND closes_at < NOW()`
    );

    for (const row of expiredPolls.rows) {
      const poll = this.mapRowToPoll(row);
      await this.closePoll(poll.id);
    }
  }

  /**
   * Close a specific poll and record on blockchain
   */
  private async closePoll(pollId: string): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get poll results
      const results = await this.getPollResults(pollId);

      // Create blockchain record
      const recordData = {
        type: 'poll_results',
        pollId: results.poll.id,
        question: results.poll.question,
        totalVotes: results.totalVotes,
        results: results.options.map(opt => ({
          text: opt.optionText,
          votes: opt.voteCount,
          percentage: opt.percentage
        })),
        closedAt: new Date().toISOString()
      };

      const blockchainRecord = await this.blockchainService.createRecord(
        JSON.stringify(recordData),
        'poll_results'
      );

      // Update poll as closed
      await client.query(
        `UPDATE polls 
         SET is_closed = true, blockchain_tx_hash = $1 
         WHERE id = $2`,
        [blockchainRecord.txHash, pollId]
      );

      await client.query('COMMIT');

      // Emit closed event
      this.eventEmitter.emit('poll:closed', {
        pollId,
        results,
        blockchainTxHash: blockchainRecord.txHash
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get poll results with percentages
   */
  private async getPollResults(pollId: string): Promise<PollResults> {
    const pollWithOptions = await this.getPoll(pollId);
    
    const optionsWithPercentage = pollWithOptions.options.map(option => ({
      ...option,
      percentage: pollWithOptions.totalVotes > 0 
        ? Math.round((option.voteCount / pollWithOptions.totalVotes) * 100)
        : 0
    }));

    return {
      poll: pollWithOptions,
      options: optionsWithPercentage,
      totalVotes: pollWithOptions.totalVotes
    };
  }

  // Row mapping utilities
  private mapRowToPoll(row: any): Poll {
    return {
      id: row.id,
      postId: row.post_id,
      question: row.question,
      pollType: row.poll_type,
      durationHours: row.duration_hours,
      closesAt: row.closes_at,
      isClosed: row.is_closed,
      totalVotes: row.total_votes,
      blockchainTxHash: row.blockchain_tx_hash,
      feeTxHash: row.fee_tx_hash,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRowToPollOption(row: any): PollOption {
    return {
      id: row.id,
      pollId: row.poll_id,
      optionText: row.option_text,
      optionOrder: row.option_order,
      voteCount: row.vote_count,
      createdAt: row.created_at
    };
  }

  private mapRowToPollVote(row: any): PollVote {
    return {
      pollId: row.poll_id,
      userId: row.user_id,
      optionId: row.option_id,
      votedAt: row.voted_at
    };
  }
}
