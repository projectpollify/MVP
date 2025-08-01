import { Router } from 'express';
import { SourceController } from './source.controller';
import { body, param } from 'express-validator';
import { walletAuth } from '../../auth/wallet.auth'; // Fixed import

export function createSourceRoutes(sourceController: SourceController): Router {
  const router = Router();

  // All source routes require authentication
  router.use(walletAuth.authenticateToken);

  // Attach source
  router.post(
    '/',
    [
      body('url').isURL().withMessage('Invalid URL format'),
      body('postId').optional().isUUID(),
      body('commentId').optional().isUUID()
    ],
    (req, res) => sourceController.attachSource(req, res)
  );

  // Vote on source
  router.post(
    '/:id/vote',
    [
      param('id').isUUID(),
      body('vote').isIn([-1, 1]).withMessage('Vote must be -1 or 1')
    ],
    (req, res) => sourceController.voteOnSource(req, res)
  );

  // Get AI summary
  router.get(
    '/:id/summary',
    param('id').isUUID(),
    (req, res) => sourceController.getAISummary(req, res)
  );

  return router;
}
