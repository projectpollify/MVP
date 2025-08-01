import { Request, Response } from 'express';
import { TippingService } from './tipping.service';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    walletAddress: string;
  };
}

export class TippingController {
  constructor(private tippingService: TippingService) {}

  async sendTip(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const postId = req.params.postId;
      const commentId = req.params.commentId;
      const message = req.body.message;

      const tip = await this.tippingService.sendTip(
        req.user.userId,
        req.user.walletAddress,
        { postId, commentId, message }
      );

      return res.status(200).json({
        success: true,
        data: {
          tip,
          message: '1 GRATIUM sent successfully'
        }
      });

    } catch (error: any) {
      if (error.message.includes('Daily tip limit')) {
        return res.status(429).json({
          success: false,
          error: error.message
        });
      }

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      if (error.message.includes('Cannot tip your own')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to send tip'
      });
    }
  }

  async getTips(req: AuthRequest, res: Response) {
    try {
      const postId = req.params.postId;
      const commentId = req.params.commentId;

      const tips = await this.tippingService.getTipsForContent(postId, commentId);

      return res.status(200).json({
        success: true,
        data: tips
      });

    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve tips'
      });
    }
  }

  async getUserStats(req: AuthRequest, res: Response) {
    try {
      const userId = req.params.userId;
      const stats = await this.tippingService.getUserTippingStats(userId);

      return res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve tipping stats'
      });
    }
  }
}
