import { Router } from 'express';
import { FlagController } from './flag.controller';
import { body, param, query } from 'express-validator';
import { walletAuth } from '../../auth/wallet.auth'; // Fixed import

export function createFlagRoutes(flagController: FlagController): Router {
  const router = Router();

  // All flag routes require authentication
  router.use(walletAuth.authenticateToken);

  // Flag content
  router.post(
    '/',
    [
      body('contentType').isIn(['post', 'comment', 'source']),
      body('contentId').isUUID(),
      body('reason').isIn(['spam', 'harassment', 'misinformation', 'inappropriate', 'other']),
      body('details').optional().isString().isLength({ max: 500 })
    ],
    (req, res) => flagController.flagContent(req, res)
  );

  // Get moderation queue (moderators only)
  router.get(
    '/moderation/queue',
    [
      query('status').optional().isIn(['pending', 'reviewing']),
      query('limit').optional().isInt({ min: 1, max: 100 })
    ],
    (req, res) => flagController.getModerationQueue(req, res)
  );

  // Resolve flag (moderators only)
  router.post(
    '/:flagId/resolve',
    [
      param('flagId').isUUID(),
      body('resolution').isString().isLength({ min: 10, max: 1000 }),
      body('action').isIn(['dismiss', 'remove_content', 'warn_user'])
    ],
    (req, res) => flagController.resolveFlag(req, res)
  );

  return router;
}
