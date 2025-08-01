export interface ThoughtPod {
  id: string;
  pillarId: number;
  topic: string;
  description?: string;
  phase: 'exploration' | 'deepening' | 'synthesis' | 'conclusion';
  isFocusPod: boolean;
  focusVoteCount: number;
  createdBy: string;
  startsAt: Date;
  closesAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PodDiscussion {
  id: string;
  podId: string;
  userId: string;
  content: string;
  phase: string;
  parentId?: string;
  sources: string[]; // Source IDs
  createdAt: Date;
}

export interface CreatePodDiscussionRequest {
  podId: string;
  content: string;
  sourceIds: string[]; // Required!
  parentId?: string;
}

export interface PodTimelineEntry {
  id: string;
  podId: string;
  entryType: 'claim_made' | 'source_added' | 'claim_challenged' | 'consensus_shift' | 'phase_transition';
  description: string;
  metadata: Record<string, any>;
  createdBy?: string;
  createdAt: Date;
}

export interface Pillar {
  id: number;
  name: string;
  lensType: string;
  description: string;
}
