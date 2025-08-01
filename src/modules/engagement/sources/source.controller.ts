import { Request, Response } from 'express';
import { SourceService } from './source.service';
import { AttachSourceRequest } from './source.types';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    walletAddress: string;
  };
}

export class SourceController {
  constructor(private sourceService: SourceService) {}

  async attachSource(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const request: AttachSourceRequest = req.body;
      
      const source = await this.sourceService.attachSource(
        req.user.userId,
        request
      );

      return res.status(201).json({
        success: true,
        data: source
      });

    } catch (error: any) {
      if (error.message.includes('already attached')) {
        return res.status(409).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to attach source'
      });
    }
  }

  async voteOnSource(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const sourceId = req.params.id;
      const vote = req.body.vote as -1 | 1;

      await this.sourceService.voteOnSource(
        sourceId,
        req.user.userId,
        vote
      );

      return res.status(200).json({
        success: true,
        data: { message: 'Vote recorded successfully' }
      });

    } catch (error: any) {
      if (error.message === 'Source not found') {
        return res.status(404).json({
          success: false,
          error: 'Source not found'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to record vote'
      });
    }
  }

  async getAISummary(req: AuthRequest, res: Response) {
    try {
      const sourceId = req.params.id;
      const summary = await this.sourceService.getAISummary(sourceId);

      return res.status(200).json({
        success: true,
        data: { summary }
      });

    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get AI summary'
      });
    }
  }
}
