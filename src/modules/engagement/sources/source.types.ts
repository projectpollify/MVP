export interface PostSource {
  id: string;
  postId?: string;
  commentId?: string;
  url: string;
  domain: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  aiSummary?: string;
  fetchStatus: 'pending' | 'fetched' | 'failed';
  credibilityScore: number; // 0.00 to 1.00
  upvotes: number;
  downvotes: number;
  metadata: Record<string, any>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SourceVote {
  sourceId: string;
  userId: string;
  vote: -1 | 1;
  votedAt: Date;
}

export interface DomainReputation {
  domain: string;
  totalSources: number;
  totalUpvotes: number;
  totalDownvotes: number;
  reputationScore: number;
  lastUpdated: Date;
}

export interface AttachSourceRequest {
  postId?: string;
  commentId?: string;
  url: string;
}

export interface SourceMetadata {
  title: string;
  description: string;
  image?: string;
  author?: string;
  publishedDate?: string;
  siteName?: string;
}

export interface SourceWithVote extends PostSource {
  userVote?: -1 | 1;
}

// Events
export interface SourceEvents {
  'source:attached': {
    sourceId: string;
    url: string;
    attachedTo: 'post' | 'comment';
    attachedToId: string;
  };
  'source:verified': {
    sourceId: string;
    credibilityScore: number;
  };
  'source:voted': {
    sourceId: string;
    userId: string;
    vote: -1 | 1;
    newScore: number;
  };
}
