/**
 * Slack Thread Transformer
 * Transforms SlackThread (from synthetic datasets) into CanonicalObject
 */

import type { CanonicalObject } from '@unified-memory/shared/types/canonical';
import { createCanonicalId } from '@unified-memory/shared/types/canonical';
import { generateSemanticHash } from '@unified-memory/shared/utils/semantic-hash';

export interface SlackMessage {
  ts: string;
  user_id: string;
  text: string;
  thread_ts?: string;
  bot_id?: string;
  created_at: string;
}

export interface SlackThread {
  ts: string;
  channel: string;
  messages: SlackMessage[];

  // Relations
  triggered_by_ticket?: string;
  resulted_in_issue?: string;

  // Participants
  participants: string[];

  // Context
  keywords: string[];
  sentiment?: 'positive' | 'neutral' | 'concerned' | 'urgent';

  // Decision tracking
  decision_made: boolean;
  decided_by?: string;
  decided_at?: string;

  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface SlackTransformerOptions {
  workspace?: string;
  includeMetadata?: boolean;
  preserveRawData?: boolean;
}

export class SlackTransformer {
  private workspace: string;
  private includeMetadata: boolean;
  private preserveRawData: boolean;

  constructor(options: SlackTransformerOptions = {}) {
    this.workspace = options.workspace || 'momo';
    this.includeMetadata = options.includeMetadata ?? true;
    this.preserveRawData = options.preserveRawData ?? false;
  }

  /**
   * Transform SlackThread into CanonicalObject
   */
  transform(thread: SlackThread): CanonicalObject {
    return {
      // Identifiers
      id: createCanonicalId('slack', this.workspace, 'thread', thread.ts),
      platform: 'slack',
      object_type: 'thread',

      // Core content
      title: this.extractTitle(thread),
      body: this.extractBody(thread),

      // Actors
      actors: {
        created_by: this.formatUserId(thread.messages[0].user_id),
        participants: thread.participants.map((id) => this.formatUserId(id)),
        decided_by: thread.decided_by ? this.formatUserId(thread.decided_by) : undefined,
      },

      // Timestamps
      timestamps: {
        created_at: thread.created_at,
        updated_at: thread.updated_at,
        decided_at: thread.decided_at || null,
      },

      // Relations
      relations: {
        channel_id: `slack|${this.workspace}|channel|${thread.channel}`,
        triggered_by_ticket: thread.triggered_by_ticket
          ? `zendesk|${this.workspace}|ticket|${thread.triggered_by_ticket}`
          : undefined,
        resulted_in_issue: thread.resulted_in_issue
          ? `linear|${this.workspace}|issue|${thread.resulted_in_issue}`
          : undefined,
      },

      // Properties
      properties: {
        keywords: thread.keywords,
        sentiment: thread.sentiment,
        decision_made: thread.decision_made,
        message_count: thread.messages.length,
        channel: thread.channel,
      },

      // Search text (auto-generated)
      search_text: this.generateSearchText(thread),

      // Semantic hash for duplicate detection (CDM paper recommendation)
      semantic_hash: generateSemanticHash({
        title: this.extractTitle(thread),
        body: this.extractBody(thread),
        keywords: thread.keywords,
      }),

      // Metadata
      visibility: 'team',
      schema_version: 'v1.0',

      // Raw data (if requested)
      raw: this.preserveRawData ? (thread as any) : undefined,
    };
  }

  /**
   * Transform multiple threads
   */
  transformBatch(threads: SlackThread[]): CanonicalObject[] {
    return threads.map((thread) => this.transform(thread));
  }

  /**
   * Extract title from thread (first message, truncated)
   */
  private extractTitle(thread: SlackThread): string {
    const firstMessage = thread.messages[0];
    const text = firstMessage.text;

    // Remove bot formatting
    const cleanText = text.replace(/\*\*/g, '').replace(/\n/g, ' ');

    // Truncate to 100 characters
    return cleanText.length > 100 ? cleanText.substring(0, 97) + '...' : cleanText;
  }

  /**
   * Extract body from thread (all messages formatted)
   */
  private extractBody(thread: SlackThread): string {
    return thread.messages
      .map((msg) => {
        const author = msg.bot_id ? `[Bot ${msg.bot_id}]` : `[${msg.user_id}]`;

        return `${author}: ${msg.text}`;
      })
      .join('\n\n');
  }

  /**
   * Generate search text (title + body + keywords)
   */
  private generateSearchText(thread: SlackThread): string {
    const title = this.extractTitle(thread);
    const body = this.extractBody(thread);
    const keywords = thread.keywords.join(' ');

    return `${title} ${body} ${keywords}`;
  }

  /**
   * Format user ID to canonical format
   */
  private formatUserId(userId: string): string {
    // If already in canonical format (user|...), return as is
    if (userId.includes('|')) {
      return userId;
    }

    // Otherwise, format it with workspace
    return `user|${this.workspace}|user|${userId}`;
  }

  /**
   * Validate thread before transformation
   */
  validateThread(thread: SlackThread): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!thread.ts) {
      errors.push('Missing thread ts');
    }

    if (!thread.messages || thread.messages.length === 0) {
      errors.push('No messages in thread');
    }

    if (!thread.created_at) {
      errors.push('Missing created_at timestamp');
    }

    if (!thread.updated_at) {
      errors.push('Missing updated_at timestamp');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
