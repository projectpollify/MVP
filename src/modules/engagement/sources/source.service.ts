import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import { EventEmitter } from 'events';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import {
  PostSource,
  AttachSourceRequest,
  SourceMetadata,
  SourceWithVote,
  DomainReputation
} from './source.types';

export class SourceService {
  private db: Pool;
  private eventEmitter: EventEmitter;
  private aiService: any; // Will be injected or configured

  constructor(db: Pool, eventEmitter: EventEmitter, aiService?: any) {
    this.db = db;
    this.eventEmitter = eventEmitter;
    this.aiService = aiService;
  }

  /**
   * Attach a source to a post or comment
   */
  async attachSource(
    userId: string,
    request: AttachSourceRequest
  ): Promise<PostSource> {
    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(request.url);
    } catch (error) {
      throw new Error('Invalid URL format');
    }

    const domain = parsedUrl.hostname.replace('www.', '');

    // Check if source already exists for this content
    const existingSource = await this.checkExistingSource(
      request.postId,
      request.commentId,
      request.url
    );

    if (existingSource) {
      throw new Error('This source is already attached to this content');
    }

    // Create source record
    const sourceId = uuidv4();
    const result = await this.db.query(
      `INSERT INTO post_sources (
        id, post_id, comment_id, url, domain, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        sourceId,
        request.postId || null,
        request.commentId || null,
        request.url,
        domain,
        userId
      ]
    );

    const source = this.mapRowToSource(result.rows[0]);

    // Update domain reputation
    await this.updateDomainStats(domain);

    // Emit event
    this.eventEmitter.emit('source:attached', {
      sourceId: source.id,
      url: source.url,
      attachedTo: request.postId ? 'post' : 'comment',
      attachedToId: request.postId || request.commentId!
    });

    // Fetch metadata asynchronously
    this.fetchSourceMetadata(sourceId, request.url).catch(err => {
      console.error('Error fetching source metadata:', err);
    });

    return source;
  }

  /**
   * Vote on source credibility
   */
  async voteOnSource(
    sourceId: string,
    userId: string,
    vote: -1 | 1
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Check if source exists
      const sourceResult = await client.query(
        'SELECT * FROM post_sources WHERE id = $1',
        [sourceId]
      );

      if (sourceResult.rows.length === 0) {
        throw new Error('Source not found');
      }

      // Check for existing vote
      const existingVote = await client.query(
        'SELECT vote FROM source_votes WHERE source_id = $1 AND user_id = $2',
        [sourceId, userId]
      );

      let voteChange = vote;
      
      if (existingVote.rows.length > 0) {
        const oldVote = existingVote.rows[0].vote;
        if (oldVote === vote) {
          throw new Error('You have already voted this way');
        }
        // User is changing their vote
        voteChange = vote - oldVote; // Will be +2 or -2

        await client.query(
          'UPDATE source_votes SET vote = $1, voted_at = NOW() WHERE source_id = $2 AND user_id = $3',
          [vote, sourceId, userId]
        );
      } else {
        // New vote
        await client.query(
          'INSERT INTO source_votes (source_id, user_id, vote) VALUES ($1, $2, $3)',
          [sourceId, userId, vote]
        );
      }

      // Update source vote counts
      if (vote === 1) {
        await client.query(
          'UPDATE post_sources SET upvotes = upvotes + $1 WHERE id = $2',
          [voteChange > 0 ? 1 : 0, sourceId]
        );
        if (voteChange === 2) { // Changed from downvote to upvote
          await client.query(
            'UPDATE post_sources SET downvotes = downvotes - 1 WHERE id = $2',
            [sourceId]
          );
        }
      } else {
        await client.query(
          'UPDATE post_sources SET downvotes = downvotes + $1 WHERE id = $2',
          [voteChange < 0 ? 1 : 0, sourceId]
        );
        if (voteChange === -2) { // Changed from upvote to downvote
          await client.query(
            'UPDATE post_sources SET upvotes = upvotes - 1 WHERE id = $2',
            [sourceId]
          );
        }
      }

      // Recalculate credibility score
      const newScore = await this.updateCredibilityScore(sourceId);

      await client.query('COMMIT');

      // Update domain reputation
      const source = this.mapRowToSource(sourceResult.rows[0]);
      await this.updateDomainStats(source.domain);

      // Emit event
      this.eventEmitter.emit('source:voted', {
        sourceId,
        userId,
        vote,
        newScore
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get sources for a post or comment
   */
  async getSourcesForContent(
    postId?: string,
    commentId?: string,
    userId?: string
  ): Promise<SourceWithVote[]> {
    let query = `
      SELECT 
        s.*,
        sv.vote as user_vote
      FROM post_sources s
      LEFT JOIN source_votes sv ON s.id = sv.source_id AND sv.user_id = $1
      WHERE 
    `;

    const params: any[] = [userId || null];

    if (postId) {
      query += 's.post_id = $2';
      params.push(postId);
    } else if (commentId) {
      query += 's.comment_id = $2';
      params.push(commentId);
    } else {
      throw new Error('Must provide either postId or commentId');
    }

    query += ' ORDER BY s.credibility_score DESC, s.created_at DESC';

    const result = await this.db.query(query, params);

    return result.rows.map(row => ({
      ...this.mapRowToSource(row),
      userVote: row.user_vote
    }));
  }

  /**
   * Get AI summary for a source
   */
  async getAISummary(sourceId: string): Promise<string> {
    const result = await this.db.query(
      'SELECT * FROM post_sources WHERE id = $1',
      [sourceId]
    );

    if (result.rows.length === 0) {
      throw new Error('Source not found');
    }

    const source = this.mapRowToSource(result.rows[0]);

    if (source.aiSummary) {
      return source.aiSummary;
    }

    if (source.fetchStatus === 'failed') {
      throw new Error('Unable to fetch source content');
    }

    if (source.fetchStatus === 'pending') {
      throw new Error('Source content is still being processed');
    }

    // Generate AI summary if not exists
    const summary = await this.generateAISummary(source);
    
    await this.db.query(
      'UPDATE post_sources SET ai_summary = $1 WHERE id = $2',
      [summary, sourceId]
    );

    return summary;
  }

  /**
   * Private helper methods
   */

  private async checkExistingSource(
    postId?: string,
    commentId?: string,
    url?: string
  ): Promise<boolean> {
    let query = 'SELECT id FROM post_sources WHERE url = $1 AND ';
    const params = [url];

    if (postId) {
      query += 'post_id = $2';
      params.push(postId);
    } else {
      query += 'comment_id = $2';
      params.push(commentId!);
    }

    const result = await this.db.query(query, params);
    return result.rows.length > 0;
  }

  private async fetchSourceMetadata(sourceId: string, url: string): Promise<void> {
    try {
      // Fetch the webpage
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Pollify/1.0)'
        }
      });

      const $ = cheerio.load(response.data);

      // Extract metadata
      const metadata: SourceMetadata = {
        title: $('meta[property="og:title"]').attr('content') ||
               $('title').text() ||
               'Untitled',
        description: $('meta[property="og:description"]').attr('content') ||
                    $('meta[name="description"]').attr('content') ||
                    '',
        image: $('meta[property="og:image"]').attr('content'),
        author: $('meta[name="author"]').attr('content'),
        publishedDate: $('meta[property="article:published_time"]').attr('content'),
        siteName: $('meta[property="og:site_name"]').attr('content')
      };

      // Update source with metadata
      await this.db.query(
        `UPDATE post_sources 
         SET title = $1, description = $2, image_url = $3, 
             metadata = $4, fetch_status = 'fetched'
         WHERE id = $5`,
        [
          metadata.title,
          metadata.description,
          metadata.image,
          JSON.stringify(metadata),
          sourceId
        ]
      );

      // Generate AI summary if content available
      if (metadata.title || metadata.description) {
        this.generateAndStoreAISummary(sourceId, metadata).catch(err => {
          console.error('Error generating AI summary:', err);
        });
      }

    } catch (error) {
      console.error('Error fetching source metadata:', error);
      await this.db.query(
        'UPDATE post_sources SET fetch_status = $1 WHERE id = $2',
        ['failed', sourceId]
      );
    }
  }

  private async generateAndStoreAISummary(
    sourceId: string,
    metadata: SourceMetadata
  ): Promise<void> {
    if (!this.aiService) {
      return; // AI service not configured
    }

    try {
      const prompt = `Summarize this article in one concise sentence (max 100 characters):
Title: ${metadata.title}
Description: ${metadata.description}`;

      // This would call your AI service (OpenAI, local model, etc.)
      const summary = await this.aiService.generateSummary(prompt);

      await this.db.query(
        'UPDATE post_sources SET ai_summary = $1 WHERE id = $2',
        [summary, sourceId]
      );
    } catch (error) {
      console.error('Error generating AI summary:', error);
    }
  }

  private async generateAISummary(source: PostSource): Promise<string> {
    if (!this.aiService) {
      return 'AI summary not available';
    }

    const prompt = `Summarize this source in one concise sentence (max 100 characters):
URL: ${source.url}
Title: ${source.title || 'Unknown'}
Description: ${source.description || 'No description'}`;

    try {
      return await this.aiService.generateSummary(prompt);
    } catch (error) {
      return 'Unable to generate summary';
    }
  }

  private async updateCredibilityScore(sourceId: string): Promise<number> {
    const result = await this.db.query(
      'SELECT upvotes, downvotes FROM post_sources WHERE id = $1',
      [sourceId]
    );

    const { upvotes, downvotes } = result.rows[0];
    const totalVotes = upvotes + downvotes;

    // Wilson score interval for ranking
    let score = 0.5; // Default neutral score
    
    if (totalVotes > 0) {
      const z = 1.96; // 95% confidence
      const phat = upvotes / totalVotes;
      const denominator = 1 + (z * z) / totalVotes;
      const numerator = phat + (z * z) / (2 * totalVotes) - 
                       z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * totalVotes)) / totalVotes);
      score = numerator / denominator;
    }

    await this.db.query(
      'UPDATE post_sources SET credibility_score = $1 WHERE id = $2',
      [score.toFixed(2), sourceId]
    );

    return score;
  }

  private async updateDomainStats(domain: string): Promise<void> {
    // Get all sources for this domain
    const result = await this.db.query(
      `SELECT 
        COUNT(*) as total_sources,
        COALESCE(SUM(upvotes), 0) as total_upvotes,
        COALESCE(SUM(downvotes), 0) as total_downvotes
       FROM post_sources 
       WHERE domain = $1`,
      [domain]
    );

    const { total_sources, total_upvotes, total_downvotes } = result.rows[0];

    // Calculate domain reputation
    let reputationScore = 0.5;
    const totalVotes = parseInt(total_upvotes) + parseInt(total_downvotes);
    
    if (totalVotes > 10) { // Minimum votes for reputation
      reputationScore = parseInt(total_upvotes) / totalVotes;
    }

    // Upsert domain reputation
    await this.db.query(
      `INSERT INTO domain_reputation 
       (domain, total_sources, total_upvotes, total_downvotes, reputation_score)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (domain) 
       DO UPDATE SET 
         total_sources = $2,
         total_upvotes = $3,
         total_downvotes = $4,
         reputation_score = $5,
         last_updated = NOW()`,
      [domain, total_sources, total_upvotes, total_downvotes, reputationScore.toFixed(2)]
    );
  }

  private mapRowToSource(row: any): PostSource {
    return {
      id: row.id,
      postId: row.post_id,
      commentId: row.comment_id,
      url: row.url,
      domain: row.domain,
      title: row.title,
      description: row.description,
      imageUrl: row.image_url,
      aiSummary: row.ai_summary,
      fetchStatus: row.fetch_status,
      credibilityScore: parseFloat(row.credibility_score),
      upvotes: row.upvotes,
      downvotes: row.downvotes,
      metadata: row.metadata,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
