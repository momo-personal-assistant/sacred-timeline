/**
 * TypeScript types for canonical_objects table
 */

// =============================================================================
// Platform and Object Type Enums
// =============================================================================

export type Platform =
  | 'github'
  | 'notion'
  | 'slack'
  | 'discord'
  | 'email'
  | 'linear'
  | 'jira'
  | 'asana'
  | string;

export type ObjectType =
  // GitHub
  | 'issue'
  | 'pr'
  | 'commit'
  | 'comment'
  | 'review'
  | 'release'
  // Notion
  | 'page'
  | 'database'
  | 'block'
  // Slack/Discord
  | 'message'
  | 'thread'
  | 'channel'
  // Calendar
  | 'meeting'
  | 'event'
  // Generic
  | string;

export type Visibility = 'private' | 'team' | 'public';

// =============================================================================
// JSONB Field Types
// =============================================================================

export interface Attachment {
  id: string;
  type: 'pdf' | 'image' | 'file' | 'link' | 'code' | string;
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
}

export interface Actors {
  created_by?: string; // Format: "user:username" or "user:email"
  updated_by?: string;
  assignees?: string[];
  participants?: string[];
  reviewers?: string[];
  mentioned?: string[];
  [key: string]: string | string[] | undefined;
}

export interface Timestamps {
  created_at: string; // ISO 8601 format
  updated_at: string;
  closed_at?: string | null;
  merged_at?: string | null;
  deleted_at?: string | null;
  start?: string | null; // For meetings/events
  end?: string | null;
  [key: string]: string | null | undefined;
}

export interface Relations {
  thread_id?: string;
  parent_id?: string;
  project_id?: string;
  channel_id?: string;
  repo_id?: string;
  calendar_id?: string;
  database_id?: string;
  linked_prs?: string[];
  linked_issues?: string[];
  linked_pages?: string[];
  [key: string]: string | string[] | undefined;
}

export interface Properties {
  labels?: string[];
  status?: string; // open, closed, merged, done, in_progress, etc.
  priority?: string; // P0, P1, P2, P3, urgent, high, medium, low
  location?: string;
  url?: string;
  milestone?: string;
  state?: string;
  [key: string]: string | string[] | number | boolean | null | undefined;
}

export interface Summary {
  short?: string; // 1 sentence
  medium?: string; // 2-3 sentences
  long?: string; // 1 paragraph
  keywords?: string[];
  [key: string]: string | string[] | undefined;
}

// =============================================================================
// Main Canonical Object Type
// =============================================================================

export interface CanonicalObject {
  id: string; // Format: "platform|workspace|type|id"
  platform: Platform;
  object_type: ObjectType;
  title?: string | null;
  body?: string | null;
  attachments?: Attachment[] | null;
  actors: Actors;
  timestamps: Timestamps;
  relations?: Relations | null;
  properties?: Properties | null;
  summary?: Summary | null;
  search_text?: string | null;
  semantic_hash?: string | null;
  visibility: Visibility;
  schema_version?: string;
  deleted_at?: Date | null;
  indexed_at?: Date | null;
  raw?: Record<string, unknown> | null; // Original API response
}

// =============================================================================
// Input Types for Creating/Updating
// =============================================================================

export interface CreateCanonicalObjectInput {
  id: string;
  platform: Platform;
  object_type: ObjectType;
  title?: string;
  body?: string;
  attachments?: Attachment[];
  actors: Actors;
  timestamps: Timestamps;
  relations?: Relations;
  properties?: Properties;
  summary?: Summary;
  semantic_hash?: string;
  visibility?: Visibility;
  raw?: Record<string, unknown>;
}

export interface UpdateCanonicalObjectInput {
  title?: string;
  body?: string;
  attachments?: Attachment[];
  actors?: Actors;
  timestamps?: Timestamps;
  relations?: Relations;
  properties?: Properties;
  summary?: Summary;
  semantic_hash?: string;
  visibility?: Visibility;
  raw?: Record<string, unknown>;
}

// =============================================================================
// Search and Query Types
// =============================================================================

export interface CanonicalObjectFilters {
  platform?: Platform | Platform[];
  object_type?: ObjectType | ObjectType[];
  visibility?: Visibility;
  created_after?: Date | string;
  created_before?: Date | string;
  updated_after?: Date | string;
  updated_before?: Date | string;
  created_by?: string;
  participant?: string;
  has_label?: string;
  status?: string;
  search_query?: string; // Full-text search
  include_deleted?: boolean;
}

export interface CanonicalObjectSearchResult extends CanonicalObject {
  search_rank?: number; // Relevance score from full-text search
}

// =============================================================================
// Helper Functions for ID Generation
// =============================================================================

export function generateCanonicalId(
  platform: Platform,
  workspace: string,
  objectType: ObjectType,
  platformId: string
): string {
  return `${platform}|${workspace}|${objectType}|${platformId}`;
}

export function parseCanonicalId(id: string): {
  platform: Platform;
  workspace: string;
  objectType: ObjectType;
  platformId: string;
} | null {
  const parts = id.split('|');
  if (parts.length !== 4) {
    return null;
  }
  return {
    platform: parts[0] as Platform,
    workspace: parts[1],
    objectType: parts[2] as ObjectType,
    platformId: parts[3],
  };
}
