import { Router } from 'express';
import { NeuralPollinatorController } from './neural-pollinator.controller';
import { body, param } from 'express-validator';
import { walletAuth } from '../../auth/middleware/wallet-auth.middleware';

export function createNeuralPollinatorRoutes(controller: NeuralPollinatorController): Router {
  const router = Router();

  // Public routes
  router.get('/', (req, res) => controller.getThoughtPods(req, res));
  router.get('/:id', param('id').isUUID(), (req, res) => controller.getPodDetails(req, res));

  // Authenticated routes
  router.use(walletAuth.authenticateToken);

  // Create discussion
  router.post(
    '/:id/discussions',
    [
      param('id').isUUID(),
      body('content').isString().isLength({ min: 10, max: 5000 }),
      body('sourceIds').isArray({ min: 1 }),
      body('sourceIds.*').isUUID(),
      body('parentId').optional().isUUID()
    ],
    (req, res) => controller.createDiscussion(req, res)
  );

  // Vote for focus pod
  router.post(
    '/:id/focus',
    param('id').isUUID(),
    (req, res) => controller.voteForFocusPod(req, res)
  );

  // Advance phase (curator only)
  router.put(
    '/:podId/phase',
    [
      param('podId').isUUID(),
      body('newPhase').isIn(['exploration', 'deepening', 'synthesis', 'conclusion'])
    ],
    (req, res) => controller.advancePodPhase(req, res)
  );

  return router;
}
