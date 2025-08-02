import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { eventEmitter } from '../../../shared/events';

export class FlagService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async createFlag(
    userId: string,
    contentType: 'post' | 'comment',
    contentId: string,
    reason: string,
    groupId: string
  ) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if user already flagged this content
      const existingFlag = await client.query(
        `SELECT id FROM content_flags 
         WHERE user_id = $1 AND content_type = $2 AND content_id = $3`,
        [userId, contentType, contentId]
      );

      if (existingFlag.rows.length > 0) {
        throw new Error('You have already flagged this content');
      }

      // Create the flag
      const flagId = uuidv4();
      await client.query(
        `INSERT INTO content_flags (id, user_id, content_type, content_id, reason, group_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [flagId, userId, contentType, contentId, reason, groupId]
      );

      // Get total flag count for this content
      const flagCountResult = await client.query(
        `SELECT COUNT(*) as count FROM content_flags 
         WHERE content_type = $1 AND content_id = $2`,
        [contentType, contentId]
      );
      
      const totalFlagCount = parseInt(flagCountResult.rows[0].count);

      // Auto-hide content if it reaches threshold (5 flags)
      if (totalFlagCount >= 5) {
        if (contentType === 'post') {
          await client.query(
            `UPDATE posts SET is_hidden = true, hidden_at = NOW() WHERE id = $1`,
            [contentId]
          );
        } else {
          await client.query(
            `UPDATE comments SET is_hidden = true, hidden_at = NOW() WHERE id = $1`,
            [contentId]
          );
        }
      }

      await client.query('COMMIT');

      // Emit event for moderation system
      eventEmitter.emit('content:flagged', {
        contentType,
        contentId,
        groupId,
        flagCount: totalFlagCount
      });

      return {
        id: flagId,
        message: 'Content flagged successfully',
        totalFlags: totalFlagCount,
        autoHidden: totalFlagCount >= 5
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getFlagsByContent(contentType: string, contentId: string) {
    const result = await this.pool.query(
      `SELECT cf.*, u.display_name as flagger_name
       FROM content_flags cf
       JOIN users u ON cf.user_id = u.id
       WHERE cf.content_type = $1 AND cf.content_id = $2
       ORDER BY cf.created_at DESC`,
      [contentType, contentId]
    );
    
    return result.rows;
  }

  async getUserFlags(userId: string) {
    const result = await this.pool.query(
      `SELECT cf.*, 
        CASE 
          WHEN cf.content_type = 'post' THEN p.title
          ELSE c.content
        END as content_preview
       FROM content_flags cf
       LEFT JOIN posts p ON cf.content_type = 'post' AND cf.content_id = p.id
       LEFT JOIN comments c ON cf.content_type = 'comment' AND cf.content_id = c.id
       WHERE cf.user_id = $1
       ORDER BY cf.created_at DESC`,
      [userId]
    );
    
    return result.rows;
  }

  async removeFlag(flagId: string, userId: string) {
    const result = await this.pool.query(
      `DELETE FROM content_flags WHERE id = $1 AND user_id = $2 RETURNING *`,
      [flagId, userId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Flag not found or unauthorized');
    }
    
    return { message: 'Flag removed successfully' };
  }
}
