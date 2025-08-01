import { Router } from 'express';
import { PollController } from './poll.controller';
import { PollValidator } from './poll.validator';
import { walletAuth } from '../../auth/wallet.auth'; // Fixed import

export function createPollRoutes(pollController: PollController): Router {
  const router = Router();

  // All poll routes require authentication
  router.use(walletAuth.authenticateToken);

  // Create a new poll
  router.post(
    '/',
    PollValidator.createPoll,
    PollValidator.checkDuplicateOptions,
    (req, res) => pollController.createPoll(req, res)
  );

  // Vote on a poll
  router.post(
    '/:id/vote',
    PollValidator.vote,
    (req, res) => pollController.vote(req, res)
  );

  // Get poll with results
  router.get(
    '/:id',
    PollValidator.getPoll,
    (req, res) => pollController.getPoll(req, res)
  );

  return router;
}
