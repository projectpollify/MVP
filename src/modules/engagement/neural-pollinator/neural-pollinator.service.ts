import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import { EventEmitter } from 'events';
import {
  ThoughtPod,
  PodDiscussion,
  CreatePodDiscussionRequest,
  PodTimelineEntry
} from './neural-pollinator.types';

export class NeuralPollinatorService {
  private db: Pool;
  private eventEmitter: EventEmitter;
  private blockchainService: any;
  private tokenRegistry: any;

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
   * Get all thought pods
   */
  async getThoughtPods(): Promise<ThoughtPod[]> {
    const result = await this.db.query(
      `SELECT tp.*, p.name as pillar_name, p.lens_type
       FROM thought_pods tp
       JOIN pillars p ON tp.pillar_id = p.id
       ORDER BY tp.is_focus_pod DESC, tp.focus_vote_count DESC`
    );

    return result.rows.map(this.mapRowToPod);
  }

  /**
   * Create a pod discussion with required sources
   */
  async createDiscussion(
    userId: string,
    request: CreatePodDiscussionRequest
  ): Promise<PodDiscussion> {
    if (!request.sourceIds || request.sourceIds.length === 0) {
      throw new Error('At least one source is required for pod discussions');
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Verify pod exists and is active
      const podResult = await client.query(
        'SELECT * FROM thought_pods WHERE id = $1',
        [request.podId]
      );

      if (podResult.rows.length === 0) {
        throw new Error('Thought pod not found');
      }

      const pod = this.mapRowToPod(podResult.rows[0]);

      if (new Date() > pod.closesAt) {
        throw new Error('This thought pod has closed');
      }

      // Verify all sources exist
      const sourceCheck = await client.query(
        'SELECT COUNT(*) as count FROM post_sources WHERE id = ANY($1)',
        [request.sourceIds]
      );

      if (parseInt(sourceCheck.rows[0].count) !== request.sourceIds.length) {
        throw new Error('One or more sources not found');
      }

      // Create discussion
      const discussionId = uuidv4();
      const discussionResult = await client.query(
        `INSERT INTO pod_discussions (
          id, pod_id, user_id, content, phase, parent_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          discussionId,
          request.podId,
          userId,
          request.content,
          pod.phase,
          request.parentId || null
        ]
      );

      // Link sources
      const sourcePromises = request.sourceIds.map(sourceId =>
        client.query(
          'INSERT INTO pod_discussion_sources (discussion_id, source_id) VALUES ($1, $2)',
          [discussionId, sourceId]
        )
      );

      await Promise.all(sourcePromises);

      // Add to truth timeline
      await this.addTimelineEntry(
        pod.id,
        'claim_made',
        `New claim added to ${pod.phase} phase`,
        { discussionId, sourceCount: request.sourceIds.length },
        userId
      );

      await client.query('COMMIT');

      const discussion = this.mapRowToDiscussion(discussionResult.rows[0]);
      discussion.sources = request.sourceIds;

      this.eventEmitter.emit('pod:discussion_created', {
        podId: pod.id,
        discussionId: discussion.id,
        phase: pod.phase
      });

      return discussion;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Vote for monthly focus pod (costs 1 PCO)
   */
  async voteForFocusPod(
    podId: string,
    userId: string,
    walletAddress: string
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Check if already voted this month
      const existingVote = await client.query(
        `SELECT * FROM pod_focus_votes 
         WHERE user_id = $1 
         AND voted_at >= date_trunc('month', CURRENT_DATE)`,
        [userId]
      );

      if (existingVote.rows.length > 0) {
        throw new Error('You have already voted for a focus pod this month');
      }

      // Charge 1 PCO
      const pcoAmount = this.tokenRegistry.parseAmount('PCO', 1);
      const transfer = await this.blockchainService.transferToken({
        token: 'PCO',
        amount: pcoAmount,
        from: walletAddress,
        to: process.env.PLATFORM_WALLET_ADDRESS,
        memo: 'Focus pod vote'
      });

      if (!transfer.txHash) {
        throw new Error('Failed to process PCO payment');
      }

      // Record vote
      await client.query(
        'INSERT INTO pod_focus_votes (pod_id, user_id, tx_hash) VALUES ($1, $2, $3)',
        [podId, userId, transfer.txHash]
      );

      // Update vote count
      await client.query(
        'UPDATE thought_pods SET focus_vote_count = focus_vote_count + 1 WHERE id = $1',
        [podId]
      );

      await client.query('COMMIT');

      this.eventEmitter.emit('pod:focus_voted', {
        podId,
        userId,
        txHash: transfer.txHash
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get pod with discussions and timeline
   */
  async getPodDetails(podId: string): Promise<{
    pod: ThoughtPod;
    discussions: PodDiscussion[];
    timeline: PodTimelineEntry[];
  }> {
    const [podResult, discussions, timeline] = await Promise.all([
      this.db.query(
        `SELECT tp.*, p.name as pillar_name, p.lens_type
         FROM thought_pods tp
         JOIN pillars p ON tp.pillar_id = p.id
         WHERE tp.id = $1`,
        [podId]
      ),
      this.getPodDiscussions(podId),
      this.getPodTimeline(podId)
    ]);

    if (podResult.rows.length === 0) {
      throw new Error('Thought pod not found');
    }

    return {
      pod: this.mapRowToPod(podResult.rows[0]),
      discussions,
      timeline
    };
  }

  /**
   * Advance pod phase (curator only)
   */
  async advancePodPhase(
    podId: string,
    curatorId: string,
    newPhase: string
  ): Promise<void> {
    // Verify curator permissions (integrate with auth)
    // For MVP, we'll assume curatorId is validated

    await this.db.query(
      'UPDATE thought_pods SET phase = $1, updated_at = NOW() WHERE id = $2',
      [newPhase, podId]
    );

    await this.addTimelineEntry(
      podId,
      'phase_transition',
      `Pod advanced to ${newPhase} phase`,
      { newPhase },
      curatorId
    );

    this.eventEmitter.emit('pod:phase_advanced', {
      podId,
      newPhase,
      curatorId
    });
  }

  private async getPodDiscussions(podId: string): Promise<PodDiscussion[]> {
    const result = await this.db.query(
      `SELECT 
        d.*,
        array_agg(ds.source_id) as source_ids
       FROM pod_discussions d
       LEFT JOIN pod_discussion_sources ds ON d.id = ds.discussion_id
       WHERE d.pod_id = $1
       GROUP BY d.id
       ORDER BY d.created_at DESC`,
      [podId]
    );

    return result.rows.map(row => ({
      ...this.mapRowToDiscussion(row),
      sources: row.source_ids || []
    }));
  }

  private async getPodTimeline(podId: string): Promise<PodTimelineEntry[]> {
    const result = await this.db.query(
      `SELECT * FROM truth_timeline_entries 
       WHERE pod_id = $1 
       ORDER BY created_at DESC`,
      [podId]
    );

    return result.rows.map(row => ({
      id: row.id,
      podId: row.pod_id,
      entryType: row.entry_type,
      description: row.description,
      metadata: row.metadata,
      createdBy: row.created_by,
      createdAt: row.created_at
    }));
  }

  private async addTimelineEntry(
    podId: string,
    entryType: string,
    description: string,
    metadata: any,
    userId?: string
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO truth_timeline_entries 
       (id, pod_id, entry_type, description, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        uuidv4(),
        podId,
        entryType,
        description,
        JSON.stringify(metadata),
        userId || null
      ]
    );
  }

  private mapRowToPod(row: any): ThoughtPod {
    return {
      id: row.id,
      pillarId: row.pillar_id,
      topic: row.topic,
      description: row.description,
      phase: row.phase,
      isFocusPod: row.is_focus_pod,
      focusVoteCount: row.focus_vote_count,
      createdBy: row.created_by,
      startsAt: row.starts_at,
      closesAt: row.closes_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRowToDiscussion(row: any): PodDiscussion {
    return {
      id: row.id,
      podId: row.pod_id,
      userId: row.user_id,
      content: row.content,
      phase: row.phase,
      parentId: row.parent_id,
      sources: [],
      createdAt: row.created_at
    };
  }
}
