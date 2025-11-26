/**
 * Canonical Object Types
 * Based on db/migrations/002_create_canonical_objects.sql
 */

import { z } from 'zod';

/**
 * Attachment types
 */
export const AttachmentSchema = z.object({
  id: z.string(),
  type: z.enum(['pdf', 'image', 'file', 'link', 'code']),
  name: z.string(),
  url: z.string().url(),
  size: z.number().optional(),
  mimeType: z.string().optional(),
});

export type Attachment = z.infer<typeof AttachmentSchema>;

/**
 * Actors (people involved with the object)
 */
export const ActorsSchema = z.object({
  created_by: z.string().optional(),
  updated_by: z.string().optional(),
  assignees: z.array(z.string()).optional(),
  participants: z.array(z.string()).optional(),
  reviewers: z.array(z.string()).optional(),
  mentioned: z.array(z.string()).optional(),
  decided_by: z.string().optional(), // For Slack threads
});

export type Actors = z.infer<typeof ActorsSchema>;

/**
 * Timestamps
 */
export const TimestampsSchema = z.object({
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  closed_at: z.string().datetime().nullable().optional(),
  merged_at: z.string().datetime().nullable().optional(),
  deleted_at: z.string().datetime().nullable().optional(),
  decided_at: z.string().datetime().nullable().optional(), // For Slack threads
  start: z.string().datetime().nullable().optional(),
  end: z.string().datetime().nullable().optional(),
});

export type Timestamps = z.infer<typeof TimestampsSchema>;

/**
 * Relations (connections to other objects)
 */
export const RelationsSchema = z
  .object({
    thread_id: z.string().optional(),
    parent_id: z.string().optional(),
    project_id: z.string().optional(),
    channel_id: z.string().optional(),
    repo_id: z.string().optional(),
    calendar_id: z.string().optional(),
    linked_prs: z.array(z.string()).optional(),
    linked_issues: z.array(z.string()).optional(),
    // New: for Slack threads
    triggered_by_ticket: z.string().optional(),
    resulted_in_issue: z.string().optional(),
  })
  .catchall(z.union([z.string(), z.array(z.string())]));

export type Relations = z.infer<typeof RelationsSchema>;

/**
 * Properties (platform-specific metadata)
 */
export const PropertiesSchema = z
  .object({
    labels: z.array(z.string()).optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    location: z.string().optional(),
    url: z.string().url().optional(),
    milestone: z.string().optional(),
    state: z.string().optional(),
    // New: for Slack threads
    keywords: z.array(z.string()).optional(),
    sentiment: z.enum(['positive', 'neutral', 'concerned', 'urgent']).optional(),
    decision_made: z.boolean().optional(),
    message_count: z.number().optional(),
  })
  .catchall(z.any());

export type Properties = z.infer<typeof PropertiesSchema>;

/**
 * Summary (LLM-generated summaries)
 */
export const SummarySchema = z
  .object({
    short: z.string().optional(),
    medium: z.string().optional(),
    long: z.string().optional(),
  })
  .optional();

export type Summary = z.infer<typeof SummarySchema>;

/**
 * Canonical Object - unified format for all platforms
 */
export const CanonicalObjectSchema = z.object({
  // Identifiers
  id: z.string().regex(/^[a-z]+\|[^|]+\|[a-z_]+\|[^|]+$/), // platform|workspace|type|id

  // Platform information
  platform: z.string().min(1).max(20),
  object_type: z.string().min(1).max(50),

  // Core content
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),

  // Structured data
  attachments: z.array(AttachmentSchema).optional(),
  actors: ActorsSchema,
  timestamps: TimestampsSchema,
  relations: RelationsSchema.optional(),
  properties: PropertiesSchema.optional(),
  summary: SummarySchema,

  // Search and deduplication
  search_text: z.string().optional(),
  semantic_hash: z.string().max(64).optional(),

  // Metadata
  visibility: z.enum(['private', 'team', 'public']).default('team'),
  schema_version: z.string().optional(),
  deleted_at: z.string().datetime().nullable().optional(),
  indexed_at: z.string().datetime().optional(),

  // Raw data
  raw: z.record(z.unknown()).optional(),
});

export type CanonicalObject = z.infer<typeof CanonicalObjectSchema>;

/**
 * Helper function to create a canonical object ID
 */
export function createCanonicalId(
  platform: string,
  workspace: string,
  objectType: string,
  platformId: string
): string {
  return `${platform}|${workspace}|${objectType}|${platformId}`;
}

/**
 * Helper function to parse a canonical object ID
 */
export function parseCanonicalId(id: string): {
  platform: string;
  workspace: string;
  objectType: string;
  platformId: string;
} | null {
  const parts = id.split('|');
  if (parts.length !== 4) {
    return null;
  }

  return {
    platform: parts[0],
    workspace: parts[1],
    objectType: parts[2],
    platformId: parts[3],
  };
}
