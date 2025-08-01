import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import { EventEmitter } from 'events';

interface TipRequest {
  postId?: string;
  commentId?: string;
  message?: string;
}

interface GratiumTip {
  id: string;
  postId?: string;
  commentId?: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  txHash: string;
  message?: string;
  createdAt: Date;
}

export class TippingService {
  private db: Pool;
  private eventEmitter: EventEmitter;
  private blockchainService: any;
  private tokenRegistry: any;
  private readonly DAILY_TIP_LIMIT = 20;

  constructor(
    db: Pool,
    eventEmitter: EventEmitter,
    blockchainService: any,
    tokenRegistry: any
  ) {
    this.db = db;
    this.eventEmitter = eventEmitter;
    this.blockchainService = blockchainService;
    this.tokenRegistry = tokenRegistry;
  }

  /**
   * Send a Gratium tip
   */
  async sendTip(
    fromUserId: string,
    fromWalletAddress: string,
    request: TipRequest
  ): Promise<GratiumTip> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Check daily limit
      const today = new Date().toISOString().split('T')[0];
      const dailyCount = await this.getUserDailyTipCount(fromUserId, today);

      if (dailyCount >= this.DAILY_TIP_LIMIT) {
        throw new Error(`Daily tip limit of ${this.DAILY_TIP_LIMIT} reached`);
      }

      // Get recipient info
      let toUserId: string;
      let contentType: 'post' | 'comment';

      if (request.postId) {
        const postResult = await client.query(
          'SELECT created_by FROM posts WHERE id = $1',
          [request.postId]
        );
        if (postResult.rows.length === 0) {
          throw new Error('Post not found');
        }
        toUserId = postResult.rows[0].created_by;
        contentType = 'post';
      } else if (request.commentId) {
        const commentResult = await client.query(
          'SELECT user_id FROM comments WHERE id = $1',
          [request.commentId]
        );
        if (commentResult.rows.length === 0) {
          throw new Error('Comment not found');
        }
        toUserId = commentResult.rows[0].user_id;
        contentType = 'comment';
      } else {
        throw new Error('Must specify either postId or commentId');
      }

      // Check no self-tipping
      if (fromUserId === toUserId) {
        throw new Error('Cannot tip your own content');
      }

      // Get recipient wallet address
      const recipientResult = await client.query(
        'SELECT wallet_pub_key FROM users WHERE id = $1',
        [toUserId]
      );
      const toWalletAddress = recipientResult.rows[0].wallet_pub_key;

      // Transfer 1 GRATIUM
      const gratiumAmount = this.tokenRegistry.parseAmount('GRATIUM', 1);
      const transfer = await this.blockchainService.transferToken({
        token: 'GRATIUM',
        amount: gratiumAmount,
        from: fromWalletAddress,
        to: toWalletAddress,
        memo: `Tip for ${contentType} ${request.postId || request.commentId}`
      });

      if (!transfer.txHash) {
        throw new Error('Gratium transfer failed');
      }

      // Record tip
      const tipId = uuidv4();
      const tipResult = await client.query(
        `INSERT INTO gratium_tips (
          id, post_id, comment_id, from_user_id, to_user_id, 
          amount, tx_hash, message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          tipId,
          request.postId || null,
          request.commentId || null,
          fromUserId,
          toUserId,
          1,
          transfer.txHash,
          request.message || null
        ]
      );

      // Update daily count
      await client.query(
        `INSERT INTO user_daily_tips (user_id, date, tip_count)
         VALUES ($1, $2, 1)
         ON CONFLICT (user_id, date)
         DO UPDATE SET tip_count = user_daily_tips.tip_count + 1`,
        [fromUserId, today]
      );

      await client.query('COMMIT');

      const tip = this.mapRowToTip(tipResult.rows[0]);

      // Emit event
      this.eventEmitter.emit('tip:sent', {
        tipId: tip.id,
        fromUserId: tip.fromUserId,
        toUserId: tip.toUserId,
        contentType,
        contentId: request.postId || request.commentId,
        txHash: tip.txHash
      });

      return tip;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get tips for content
   */
  async getTipsForContent(
    postId?: string,
    commentId?: string
  ): Promise<GratiumTip[]> {
    let query = 'SELECT * FROM gratium_tips WHERE ';
    let param: string;

    if (postId) {
      query += 'post_id = $1';
      param = postId;
    } else if (commentId) {
      query += 'comment_id = $1';
      param = commentId;
    } else {
      throw new Error('Must provide either postId or commentId');
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.db.query(query, [param]);
    return result.rows.map(this.mapRowToTip);
  }

  /**
   * Get user's tipping stats
   */
  async getUserTippingStats(userId: string): Promise<{
    tipsGiven: number;
    tipsReceived: number;
    todayTipsGiven: number;
    todayLimit: number;
  }> {
    const today = new Date().toISOString().split('T')[0];

    const [given, received, todayGiven] = await Promise.all([
      this.db.query(
        'SELECT COUNT(*) as count FROM gratium_tips WHERE from_user_id = $1',
        [userId]
      ),
      this.db.query(
        'SELECT COUNT(*) as count FROM gratium_tips WHERE to_user_id = $1',
        [userId]
      ),
      this.getUserDailyTipCount(userId, today)
    ]);

    return {
      tipsGiven: parseInt(given.rows[0].count),
      tipsReceived: parseInt(received.rows[0].count),
      todayTipsGiven: todayGiven,
      todayLimit: this.DAILY_TIP_LIMIT
    };
  }

  private async getUserDailyTipCount(userId: string, date: string): Promise<number> {
    const result = await this.db.query(
      'SELECT tip_count FROM user_daily_tips WHERE user_id = $1 AND date = $2',
      [userId, date]
    );

    return result.rows.length > 0 ? result.rows[0].tip_count : 0;
  }

  private mapRowToTip(row: any): GratiumTip {
    return {
      id: row.id,
      postId: row.post_id,
      commentId: row.comment_id,
      fromUserId: row.from_user_id,
      toUserId: row.to_user_id,
      amount: row.amount,
      txHash: row.tx_hash,
      message: row.message,
      createdAt: row.created_at
    };
  }
}
