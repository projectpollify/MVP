import { Request, Response } from 'express';
import { NeuralPollinatorService } from './neural-pollinator.service';
import { CreatePodDiscussionRequest } from './neural-pollinator.types';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    walletAddress: string;
  };
}

export class NeuralPollinatorController {
  constructor(private service: NeuralPollinatorService) {}

  async getThoughtPods(req: Request, res: Response) {
    try {
      const pods = await this.service.getThoughtPods();

      return res.status(200).json({
        success: true,
        data: pods
      });

    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve thought pods'
      });
    }
  }

  async getPodDetails(req: Request, res: Response) {
    try {
      const podId = req.params.id;
      const details = await this.service.getPodDetails(podId);

      return res.status(200).json({
        success: true,
        data: details
      });

    } catch (error: any) {
      if (error.message === 'Thought pod not found') {
        return res.status(404).json({
          success: false,
          error: 'Thought pod not found'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve pod details'
      });
    }
  }

  async createDiscussion(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const podId = req.params.id;
      const request: CreatePodDiscussionRequest = {
        podId,
        ...req.body
      };

      const discussion = await this.service.createDiscussion(
        req.user.userId,
        request
      );

      return res.status(201).json({
        success: true,
        data: discussion
      });

    } catch (error: any) {
      if (error.message.includes('source is required')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to create discussion'
      });
    }
  }

  async voteForFocusPod(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const podId = req.params.id;
      
      await this.service.voteForFocusPod(
        podId,
        req.user.userId,
        req.user.walletAddress
      );

      return res.status(200).json({
        success: true,
        data: {
          message: 'Focus pod vote recorded (1 PCO deducted)'
        }
      });

    } catch (error: any) {
      if (error.message.includes('already voted')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      if (error.message.includes('PCO')) {
        return res.status(402).json({
          success: false,
          error: 'Insufficient PCO balance'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to vote for focus pod'
      });
    }
  }

  async advancePodPhase(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // TODO: Check curator permissions

      const { podId } = req.params;
      const { newPhase } = req.body;

      await this.service.advancePodPhase(
        podId,
        req.user.userId,
        newPhase
      );

      return res.status(200).json({
        success: true,
        data: {
          message: `Pod advanced to ${newPhase} phase`
        }
      });

    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Failed to advance pod phase'
      });
    }
  }
}
