import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import { EventEmitter } from 'events';

interface FlagRequest {
  contentType: 'post' | 'comment' | 'source';
  contentId: string;
  reason: 'spam' | 'harassment' | 'misinformation' | 'inappropriate' | 'other';
  details?: string;
}

interface ContentFlag {
  id: string;
  contentType: string;
  contentId: string;
  flaggedBy: string;
  reason: string;
  details?: string;
  status: string;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

export class FlagService {
  private db: Pool;
  private eventEmitter: EventEmitter;
  private readonly AUTO_HIDE_THRESHOLD = 5;

  constructor(db: Pool, eventEmitter: EventEmitter) {
    this.db = db;
    this.eventEmitter = eventEmitter;
  }

  /**
   * Flag content
   */
  async flagContent(
    userId: string,
    request: FlagRequest
  ): Promise<ContentFlag> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Check if user already flagged this content
      const existingFlag = await client.query(
        `SELECT id FROM content_flags 
         WHERE content_type = $1 AND content_id = $2 AND flagged_by = $3`,
        [request.contentType, request.contentId, userId]
      );

      if (existingFlag.rows.length > 0) {
        throw new Error('You have already flagged this content');
      }

      // Create flag
      const flagId = uuidv4();
      const flagResult = await client.query(
        `INSERT INTO content_flags (
          id, content_type, content_id, flagged_by, reason, details
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          flagId,
          request.contentType,
          request.contentId,
          userId,
          request.reason,
          request.details || null
        ]
      );

      // Update flag count
      await client.query(
        `INSERT INTO flagged_content_status (content_type, content_id, flag_count)
         VALUES ($1, $2, 1)
         ON CONFLICT (content_type, content_id)
         DO UPDATE SET flag_count = flagged_content_status.flag_count + 1`,
        [request.contentType, request.contentId]
      );

      // Check if should auto-hide
      const statusResult = await client.query(
        `SELECT flag_count FROM flagged_content_status 
         WHERE content_type = $1 AND content_id = $2`,
        [request.contentType, request.contentId]
      );

      const flagCount = statusResult.rows[0].flag_count;

      if (flagCount >= this.AUTO_HIDE_THRESHOLD) {
        await client.query(
          `UPDATE flagged_content_status 
           SET is_hidden = true, hidden_at = NOW()
           WHERE content_type = $1 AND content_id = $2`,
          [request.contentType, request.contentId]
        );

        // Emit auto-hide event
        this.eventEmitter.emit('content:auto_hidden', {
          contentType: request.contentType,
          contentId: request.contentId,
          flagCount
        });
      }

      await client.query('COMMIT');

      const flag = this.mapRowToFlag(flagResult.rows[0]);

      // Emit flag event
      this.eventEmitter.emit('content:flagged', {
        flagId: flag.id,
        contentType: flag.contentType,
        contentId: flag.contentId,
        reason: flag.reason,
        flaggedBy: flag.flaggedBy
      });

      return flag;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get moderation queue
   */
  async getModerationQueue(
    status: 'pending' | 'reviewing' = 'pending',
    limit: number = 50
  ): Promise<ContentFlag[]> {
    const result = await this.db.query(
      `SELECT f.*, 
              fs.flag_count,
              fs.is_hidden
       FROM content_flags f
       JOIN flagged_content_status fs 
         ON f.content_type = fs.content_type 
         AND f.content_id = fs.content_id
       WHERE f.status = $1
       ORDER BY fs.flag_count DESC, f.created_at ASC
       LIMIT $2`,
      [status, limit]
    );

    return result.rows.map(this.mapRowToFlag);
  }

  /**
   * Resolve a flag
   */
  async resolveFlag(
    flagId: string,
    moderatorId: string,
    resolution: string,
    action: 'dismiss' | 'remove_content' | 'warn_user'
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Update flag
      await client.query(
        `UPDATE content_flags 
         SET status = 'resolved', 
             resolution = $1,
             resolved_by = $2,
             resolved_at = NOW()
         WHERE id = $3`,
        [resolution, moderatorId, flagId]
      );

      // Handle different actions
      if (action === 'dismiss') {
        // Just mark as resolved
      } else if (action === 'remove_content') {
        // This would integrate with content modules to hide/delete
        // For now, we'll mark as hidden
        const flagInfo = await client.query(
          'SELECT content_type, content_id FROM content_flags WHERE id = $1',
          [flagId]
        );

        if (flagInfo.rows.length > 0) {
          const { content_type, content_id } = flagInfo.rows[0];
          
          await client.query(
            `UPDATE flagged_content_status 
             SET is_hidden = true, hidden_at = NOW()
             WHERE content_type = $1 AND content_id = $2`,
            [content_type, content_id]
          );
        }
      }

      await client.query('COMMIT');

      this.eventEmitter.emit('flag:resolved', {
        flagId,
        resolution,
        action,
        moderatorId
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private mapRowToFlag(row: any): ContentFlag {
    return {
      id: row.id,
      contentType: row.content_type,
      contentId: row.content_id,
      flaggedBy: row.flagged_by,
      reason: row.reason,
      details: row.details,
      status: row.status,
      resolution: row.resolution,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at
    };
  }
}
