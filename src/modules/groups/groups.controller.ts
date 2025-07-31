import { Request, Response } from 'express';
import * as groupsService from './groups.service';
import { emitEvent } from '../../shared/events';

export async function getAllPillars(req: Request, res: Response) {
    try {
        const pillars = await groupsService.getAllPillars();
        res.json({ success: true, data: pillars });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function getPillarGroups(req: Request, res: Response) {
    try {
        const { pillarId } = req.params;
        const userId = req.user?.id;
        const groups = await groupsService.getPillarGroups(pillarId, userId);
        res.json({ success: true, data: groups });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function getGroupDetails(req: Request, res: Response) {
    try {
        const { groupId } = req.params;
        const userId = req.user?.id;
        const group = await groupsService.getGroupDetails(groupId, userId);
        res.json({ success: true, data: group });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function joinGroup(req: Request, res: Response) {
    try {
        const { groupId } = req.params;
        const userId = req.user!.id;
        
        await groupsService.joinGroup(userId, groupId);
        await emitEvent('groups:joined', { user_id: userId, group_id: groupId });
        
        res.json({ success: true, data: { message: 'Successfully joined group' } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function leaveGroup(req: Request, res: Response) {
    try {
        const { groupId } = req.params;
        const userId = req.user!.id;
        
        await groupsService.leaveGroup(userId, groupId);
        await emitEvent('groups:left', { user_id: userId, group_id: groupId });
        
        res.json({ success: true, data: { message: 'Successfully left group' } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function getGroupPosts(req: Request, res: Response) {
    try {
        const { groupId } = req.params;
        const { sort = 'new', page = '1', limit = '20' } = req.query;
        const userId = req.user?.id;
        
        const posts = await groupsService.getGroupPosts(
            groupId,
            sort as 'new' | 'top',
            parseInt(page as string),
            parseInt(limit as string),
            userId
        );
        
        res.json({ success: true, data: posts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function createPost(req: Request, res: Response) {
    try {
        const { groupId } = req.params;
        const { content, parent_id, sources } = req.body;
        const userId = req.user!.id;
        
        // Auto-join group if not member
        const isMember = await groupsService.checkGroupMembership(userId, groupId);
        if (!isMember) {
            await groupsService.joinGroup(userId, groupId);
        }
        
        // Create post
        const post = await groupsService.createPost({
            group_id: groupId,
            author_id: userId,
            content,
            parent_id: parent_id || null,
            sources: sources || []
        });
        
        await emitEvent('posts:created', { 
            post_id: post.id, 
            group_id: groupId, 
            author_id: userId 
        });
        
        res.json({ success: true, data: post });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function getPostWithReplies(req: Request, res: Response) {
    try {
        const { postId } = req.params;
        const userId = req.user?.id;
        
        // Increment view count
        await groupsService.incrementViewCount(postId);
        
        const postData = await groupsService.getPostWithReplies(postId, userId);
        res.json({ success: true, data: postData });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function editPost(req: Request, res: Response) {
    try {
        const { postId } = req.params;
        const { content } = req.body;
        const userId = req.user!.id;
        
        const post = await groupsService.editPost(postId, userId, content);
        await emitEvent('posts:edited', { post_id: postId, editor_id: userId });
        
        res.json({ success: true, data: post });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function deletePost(req: Request, res: Response) {
    try {
        const { postId } = req.params;
        const userId = req.user!.id;
        
        await groupsService.deletePost(postId, userId);
        await emitEvent('posts:deleted', { post_id: postId, deleter_id: userId });
        
        res.json({ success: true, data: { message: 'Post deleted' } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function flagPost(req: Request, res: Response) {
    try {
        const { postId } = req.params;
        const { reason } = req.body;
        const userId = req.user!.id;
        
        await groupsService.flagPost(postId, userId, reason);
        await emitEvent('posts:flagged', { 
            post_id: postId, 
            flagger_id: userId, 
            reason 
        });
        
        res.json({ success: true, data: { message: 'Post flagged for review' } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
