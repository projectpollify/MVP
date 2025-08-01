import { Request, Response } from 'express';
import { FlagService } from './flag.service';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    walletAddress: string;
  };
}

export class FlagController {
  constructor(private flagService: FlagService) {}

  async flagContent(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const flag = await this.flagService.flagContent(
        req.user.userId,
        req.body
      );

      return res.status(201).json({
        success: true,
        data: flag
      });

    } catch (error: any) {
      if (error.message.includes('already flagged')) {
        return res.status(409).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to flag content'
      });
    }
  }

  async getModerationQueue(req: AuthRequest, res: Response) {
    try {
      // TODO: Check moderator permissions
      
      const status = req.query.status as 'pending' | 'reviewing' || 'pending';
      const limit = parseInt(req.query.limit as string) || 50;

      const queue = await this.flagService.getModerationQueue(status, limit);

      return res.status(200).json({
        success: true,
        data: queue
      });

    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve moderation queue'
      });
    }
  }

  async resolveFlag(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // TODO: Check moderator permissions

      const { flagId } = req.params;
      const { resolution, action } = req.body;

      await this.flagService.resolveFlag(
        flagId,
        req.user.userId,
        resolution,
        action
      );

      return res.status(200).json({
        success: true,
        data: { message: 'Flag resolved successfully' }
      });

    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Failed to resolve flag'
      });
    }
  }
}
