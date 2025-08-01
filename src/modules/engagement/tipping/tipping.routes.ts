import { Router } from 'express';
import { TippingController } from './tipping.controller';
import { body, param } from 'express-validator';
import { walletAuth } from '../../auth/middleware/wallet-auth.middleware';

export function createTippingRoutes(tippingController: TippingController): Router {
  const router = Router();

  // All tipping routes require authentication
  router.use(walletAuth.authenticateToken);

  // Send tip to post
  router.post(
    '/posts/:postId/tip',
    [
      param('postId').isUUID(),
      body('message').optional().isString().isLength({ max: 200 })
    ],
    (req, res) => tippingController.sendTip(req, res)
  );

  // Send tip to comment
  router.post(
    '/comments/:commentId/tip',
    [
      param('commentId').isUUID(),
      body('message').optional().isString().isLength({ max: 200 })
    ],
    (req, res) => tippingController.sendTip(req, res)
  );

  // Get tips for post
  router.get(
    '/posts/:postId/tips',
    param('postId').isUUID(),
    (req, res) => tippingController.getTips(req, res)
  );

  // Get tips for comment
  router.get(
    '/comments/:commentId/tips',
    param('commentId').isUUID(),
    (req, res) => tippingController.getTips(req, res)
  );

  // Get user tipping stats
  router.get(
    '/users/:userId/stats',
    param('userId').isUUID(),
    (req, res) => tippingController.getUserStats(req, res)
  );

  return router;
}
