// Poll type definitions for Module 5

export interface Poll {
  id: string;
  postId: string;
  question: string;
  pollType: 'single_choice'; // MVP: only single choice
  durationHours: 24 | 72 | 168; // 24h, 3d, 7d
  closesAt: Date;
  isClosed: boolean;
  totalVotes: number;
  blockchainTxHash?: string;
  feeTxHash: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PollOption {
  id: string;
  pollId: string;
  optionText: string;
  optionOrder: number;
  voteCount: number;
  createdAt: Date;
}

export interface PollVote {
  pollId: string;
  userId: string;
  optionId: string;
  votedAt: Date;
}

export interface CreatePollRequest {
  postId: string;
  question: string;
  options: string[]; // Array of option texts
  durationHours: 24 | 72 | 168;
}

export interface VoteRequest {
  optionId: string;
}

export interface PollWithOptions extends Poll {
  options: PollOption[];
  userVote?: PollVote; // Include if user has voted
}

export interface PollResults {
  poll: Poll;
  options: Array<PollOption & {
    percentage: number;
  }>;
  totalVotes: number;
}

// Events emitted by poll system
export interface PollEvents {
  'poll:created': {
    pollId: string;
    postId: string;
    createdBy: string;
    feeTxHash: string;
  };
  'poll:voted': {
    pollId: string;
    userId: string;
    optionId: string;
  };
  'poll:closed': {
    pollId: string;
    results: PollResults;
    blockchainTxHash: string;
  };
}
