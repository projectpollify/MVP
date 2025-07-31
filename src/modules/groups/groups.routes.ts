import { Router } from 'express';
import { authenticateToken, checkUserMode } from '../auth/auth.middleware';
import * as groupsController from './groups.controller';

const router = Router();

// Pillar routes
router.get('/pillars', groupsController.getAllPillars);
router.get('/pillars/:pillarId/groups', groupsController.getPillarGroups);

// Group routes
router.get('/groups/:groupId', authenticateToken(false), groupsController.getGroupDetails);
router.post('/groups/:groupId/join', authenticateToken(), checkUserMode(['true_self', 'alias']), groupsController.joinGroup);
router.post('/groups/:groupId/leave', authenticateToken(), groupsController.leaveGroup);
router.get('/groups/:groupId/posts', groupsController.getGroupPosts);

// Post routes
router.post('/groups/:groupId/posts', authenticateToken(), checkUserMode(['true_self', 'alias']), groupsController.createPost);
router.get('/posts/:postId', authenticateToken(false), groupsController.getPostWithReplies);
router.put('/posts/:postId', authenticateToken(), groupsController.editPost);
router.delete('/posts/:postId', authenticateToken(), groupsController.deletePost);
router.post('/posts/:postId/flag', authenticateToken(), groupsController.flagPost);

export default router;
