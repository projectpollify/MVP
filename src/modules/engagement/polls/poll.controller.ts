import { Request, Response } from 'express';
import { PollService } from './poll.service';
import { CreatePollRequest, VoteRequest } from './poll.types';

// Extend Express Request to include user from auth middleware
interface AuthRequest extends Request {
  user?: {
    userId: string;
    walletAddress: string;
    chain: string;
  };
}

export class PollController {
  private pollService: PollService;

  constructor(pollService: PollService) {
    this.pollService = pollService;
  }

  /**
   * Create a new poll
   * POST /api/v1/polls
   */
  async createPoll(req: AuthRequest, res: Response) {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const { userId, walletAddress } = req.user;
      const createRequest: CreatePollRequest = req.body;

      // Create poll with PCO fee
      const poll = await this.pollService.createPoll(
        userId,
        walletAddress,
        createRequest
      );

      return res.status(201).json({
        success: true,
        data: {
          poll,
          message: '1 PCO has been deducted for creating this poll'
        }
      });

    } catch (error: any) {
      console.error('Error creating poll:', error);
      
      // Handle specific errors
      if (error.message.includes('PCO fee')) {
        return res.status(402).json({
          success: false,
          error: 'Insufficient PCO balance for poll creation'
        });
      }

      if (error.message.includes('Post not found')) {
        return res.status(404).json({
          success: false,
          error: 'Post not found'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to create poll'
      });
    }
  }

  /**
   * Vote on a poll
   * POST /api/v1/polls/:id/vote
   */
  async vote(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const { userId } = req.user;
      const pollId = req.params.id;
      const { optionId }: VoteRequest = req.body;

      // Check if user is in Soul mode (read-only)
      // This would integrate with Module 2's user system
      const userMode = await this.checkUserMode(userId);
      if (userMode === 'soul') {
        return res.status(403).json({
          success: false,
          error: 'Users in Soul mode cannot vote on polls'
        });
      }

      await this.pollService.vote(pollId, userId, optionId);

      return res.status(200).json({
        success: true,
        data: {
          message: 'Vote recorded successfully'
        }
      });

    } catch (error: any) {
      console.error('Error voting on poll:', error);

      if (error.message === 'Poll not found') {
        return res.status(404).json({
          success: false,
          error: 'Poll not found'
        });
      }

      if (error.message === 'User has already voted') {
        return res.status(409).json({
          success: false,
          error: 'You have already voted on this poll'
        });
      }

      if (error.message === 'Poll is closed' || error.message === 'Poll has expired') {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to record vote'
      });
    }
  }

  /**
   * Get poll with results
   * GET /api/v1/polls/:id
   */
  async getPoll(req: AuthRequest, res: Response) {
    try {
      const pollId = req.params.id;
      const userId = req.user?.userId; // Optional - to check if user voted

      const poll = await this.pollService.getPoll(pollId, userId);

      // Calculate percentages for display
      const pollWithPercentages = {
        ...poll,
        options: poll.options.map(option => ({
          ...option,
          percentage: poll.totalVotes > 0 
            ? Math.round((option.voteCount / poll.totalVotes) * 100)
            : 0
        }))
      };

      return res.status(200).json({
        success: true,
        data: pollWithPercentages
      });

    } catch (error: any) {
      console.error('Error getting poll:', error);

      if (error.message === 'Poll not found') {
        return res.status(404).json({
          success: false,
          error: 'Poll not found'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve poll'
      });
    }
  }

  /**
   * Helper method to check user mode
   * This would integrate with Module 2's user system
   */
  private async checkUserMode(userId: string): Promise<string> {
    // TODO: Integrate with actual user service from Module 2
    // For now, return 'active' as placeholder
    return 'active';
  }
}
