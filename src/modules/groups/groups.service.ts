import { PrismaClient } from '@prisma/client';
import { processSourceURL } from './sources.service';

const prisma = new PrismaClient();

export async function getAllPillars() {
    return await prisma.pillars.findMany({
        where: { is_active: true },
        orderBy: { display_order: 'asc' },
        include: {
            _count: {
                select: { groups: true }
            }
        }
    });
}

export async function getPillarGroups(pillarId: string, userId?: string) {
    const groups = await prisma.groups.findMany({
        where: { pillar_id: pillarId },
        include: {
            _count: {
                select: { 
                    group_memberships: true,
                    posts: { where: { is_deleted: false } }
                }
            }
        }
    });
    
    // Add membership status if user is authenticated
    if (userId) {
        const memberships = await prisma.group_memberships.findMany({
            where: {
                user_id: userId,
                group_id: { in: groups.map(g => g.id) }
            }
        });
        
        const membershipMap = new Map(memberships.map(m => [m.group_id, true]));
        
        return groups.map(group => ({
            ...group,
            member_count: group._count.group_memberships,
            post_count: group._count.posts,
            is_member: membershipMap.has(group.id)
        }));
    }
    
    return groups.map(group => ({
        ...group,
        member_count: group._count.group_memberships,
        post_count: group._count.posts,
        is_member: false
    }));
}

export async function getGroupDetails(groupId: string, userId?: string) {
    const group = await prisma.groups.findUnique({
        where: { id: groupId },
        include: {
            pillar: true,
            _count: {
                select: {
                    group_memberships: true,
                    posts: { where: { is_deleted: false } }
                }
            }
        }
    });
    
    if (!group) {
        throw new Error('Group not found');
    }
    
    let membership = null;
    if (userId) {
        membership = await prisma.group_memberships.findUnique({
            where: {
                user_id_group_id: {
                    user_id: userId,
                    group_id: groupId
                }
            }
        });
    }
    
    return {
        ...group,
        member_count: group._count.group_memberships,
        post_count: group._count.posts,
        is_member: !!membership,
        user_role: membership?.role || null
    };
}

export async function checkGroupMembership(userId: string, groupId: string) {
    const membership = await prisma.group_memberships.findUnique({
        where: {
            user_id_group_id: {
                user_id: userId,
                group_id: groupId
            }
        }
    });
    
    return !!membership;
}

export async function joinGroup(userId: string, groupId: string) {
    await prisma.$transaction([
        prisma.group_memberships.create({
            data: {
                user_id: userId,
                group_id: groupId,
                role: 'member'
            }
        }),
        prisma.groups.update({
            where: { id: groupId },
            data: { member_count: { increment: 1 } }
        })
    ]);
}

export async function leaveGroup(userId: string, groupId: string) {
    await prisma.$transaction([
        prisma.group_memberships.delete({
            where: {
                user_id_group_id: {
                    user_id: userId,
                    group_id: groupId
                }
            }
        }),
        prisma.groups.update({
            where: { id: groupId },
            data: { member_count: { decrement: 1 } }
        })
    ]);
}

export async function getGroupPosts(
    groupId: string, 
    sort: 'new' | 'top',
    page: number,
    limit: number,
    userId?: string
) {
    const skip = (page - 1) * limit;
    
    const where = {
        group_id: groupId,
        parent_id: null,
        is_deleted: false
    };
    
    const orderBy = sort === 'new' 
        ? { created_at: 'desc' as const }
        : { view_count: 'desc' as const };
    
    const [posts, total] = await Promise.all([
        prisma.posts.findMany({
            where,
            orderBy,
            skip,
            take: limit,
            include: {
                author: {
                    select: {
                        id: true,
                        display_name: true,
                        mode: true
                    }
                },
                post_sources: true,
                _count: {
                    select: {
                        posts: true // Count of replies
                    }
                }
            }
        }),
        prisma.posts.count({ where })
    ]);
    
    // Process posts
    const processedPosts = posts.map(post => ({
        id: post.id,
        author: post.author,
        content: post.content,
        created_at: post.created_at,
        view_count: post.view_count,
        reply_count: post._count.posts,
        is_edited: post.is_edited,
        sources: post.post_sources.map(s => ({
            url: s.url,
            title: s.title,
            ai_summary: s.ai_summary
        })),
        can_edit: userId === post.author_id && canStillEdit(post.created_at),
        can_delete: userId === post.author_id
    }));
    
    return {
        posts: processedPosts,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    };
}

export async function createPost(data: {
    group_id: string;
    author_id: string;
    content: string;
    parent_id: string | null;
    sources: string[];
}) {
    // Calculate thread depth
    let thread_depth = 0;
    if (data.parent_id) {
        const parent = await prisma.posts.findUnique({
            where: { id: data.parent_id },
            select: { thread_depth: true }
        });
        
        if (!parent) {
            throw new Error('Parent post not found');
        }
        
        if (parent.thread_depth >= 5) {
            throw new Error('Maximum thread depth reached');
        }
        
        thread_depth = parent.thread_depth + 1;
    }
    
    // Create post
    const post = await prisma.posts.create({
        data: {
            group_id: data.group_id,
            author_id: data.author_id,
            content: data.content,
            parent_id: data.parent_id,
            thread_depth
        },
        include: {
            author: {
                select: {
                    id: true,
                    display_name: true,
                    mode: true
                }
            }
        }
    });
    
    // Process sources
    if (data.sources && data.sources.length > 0) {
        const sourcePromises = data.sources.map(async (url) => {
            const sourceData = await processSourceURL(url);
            return prisma.post_sources.create({
                data: {
                    post_id: post.id,
                    ...sourceData
                }
            });
        });
        
        await Promise.all(sourcePromises);
    }
    
    // Update group activity
    await prisma.groups.update({
        where: { id: data.group_id },
        data: { 
            last_activity_at: new Date(),
            post_count: { increment: 1 }
        }
    });
    
    return post;
}

export async function getPostWithReplies(postId: string, userId?: string) {
    const post = await prisma.posts.findUnique({
        where: { id: postId },
        include: {
            author: {
                select: {
                    id: true,
                    display_name: true,
                    mode: true
                }
            },
            post_sources: true,
            group: {
                select: {
                    id: true,
                    name: true,
                    pillar: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            }
        }
    });
    
    if (!post || post.is_deleted) {
        throw new Error('Post not found');
    }
    
    // Get all replies recursively
    const replies = await getPostReplies(postId);
    
    return {
        post: {
            ...post,
            content: post.is_deleted ? '[deleted]' : post.content,
            can_edit: userId === post.author_id && canStillEdit(post.created_at),
            can_delete: userId === post.author_id
        },
        replies
    };
}

async function getPostReplies(parentId: string): Promise<any[]> {
    const replies = await prisma.posts.findMany({
        where: { parent_id: parentId },
        orderBy: { created_at: 'asc' },
        include: {
            author: {
                select: {
                    id: true,
                    display_name: true,
                    mode: true
                }
            },
            post_sources: true,
            _count: {
                select: { posts: true }
            }
        }
    });
    
    const processedReplies = await Promise.all(
        replies.map(async (reply) => {
            const childReplies = reply._count.posts > 0 
                ? await getPostReplies(reply.id)
                : [];
            
            return {
                ...reply,
                content: reply.is_deleted ? '[deleted]' : reply.content,
                replies: childReplies
            };
        })
    );
    
    return processedReplies;
}

export async function editPost(postId: string, userId: string, content: string) {
    const post = await prisma.posts.findUnique({
        where: { id: postId },
        select: { 
            author_id: true, 
            created_at: true,
            is_deleted: true 
        }
    });
    
    if (!post || post.is_deleted) {
        throw new Error('Post not found');
    }
    
    if (post.author_id !== userId) {
        throw new Error('Unauthorized');
    }
    
    if (!canStillEdit(post.created_at)) {
        throw new Error('Edit window has expired');
    }
    
    return await prisma.posts.update({
        where: { id: postId },
        data: {
            content,
            is_edited: true,
            edited_at: new Date()
        }
    });
}

export async function deletePost(postId: string, userId: string) {
    const post = await prisma.posts.findUnique({
        where: { id: postId },
        select: { author_id: true, group_id: true }
    });
    
    if (!post) {
        throw new Error('Post not found');
    }
    
    if (post.author_id !== userId) {
        throw new Error('Unauthorized');
    }
    
    await prisma.$transaction([
        prisma.posts.update({
            where: { id: postId },
            data: {
                is_deleted: true,
                deleted_at: new Date(),
                content: '[deleted]'
            }
        }),
        prisma.groups.update({
            where: { id: post.group_id },
            data: { post_count: { decrement: 1 } }
        })
    ]);
}

export async function flagPost(postId: string, userId: string, reason: string) {
    await prisma.post_flags.create({
        data: {
            post_id: postId,
            user_id: userId,
            reason
        }
    });
}

export async function incrementViewCount(postId: string) {
    await prisma.posts.update({
        where: { id: postId },
        data: { view_count: { increment: 1 } }
    });
}

function canStillEdit(createdAt: Date): boolean {
    const editWindowMinutes = parseInt(process.env.POST_EDIT_WINDOW_MINUTES || '10');
    const now = new Date();
    const diff = now.getTime() - createdAt.getTime();
    const minutes = Math.floor(diff / 60000);
    return minutes <= editWindowMinutes;
}
