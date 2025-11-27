/**
 * Notion Transformer
 * Transforms Notion pages (meeting notes, feedback) into CanonicalObject
 */

import type { CanonicalObject } from '@unified-memory/shared/types/canonical';
import { createCanonicalId } from '@unified-memory/shared/types/canonical';
import { generateSemanticHash } from '@unified-memory/shared/utils/semantic-hash';

/**
 * Notion page types we support
 */
export type NotionObjectType = 'meeting_note' | 'feedback' | 'page';

/**
 * Notion API page structure (simplified)
 */
export interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;

  // Properties (from database)
  properties: {
    title?: NotionRichText[];
    [key: string]: any;
  };

  // Page content (blocks)
  content?: string;

  // Metadata
  created_by?: {
    id: string;
    name?: string;
    email?: string;
  };
  last_edited_by?: {
    id: string;
    name?: string;
    email?: string;
  };

  // Parent (database or page)
  parent?: {
    type: string;
    database_id?: string;
    page_id?: string;
  };

  // Custom fields for our use case
  object_type?: NotionObjectType;
  participants?: string[];
  keywords?: string[];
  linked_issues?: string[];
  note_type?: string;
}

export interface NotionRichText {
  type: 'text' | 'mention' | 'equation';
  text?: {
    content: string;
    link?: { url: string };
  };
  plain_text: string;
}

export interface NotionTransformerOptions {
  workspace?: string;
  includeMetadata?: boolean;
  preserveRawData?: boolean;
}

export class NotionTransformer {
  private workspace: string;
  private includeMetadata: boolean;
  private preserveRawData: boolean;

  constructor(options: NotionTransformerOptions = {}) {
    this.workspace = options.workspace || 'tenxai';
    this.includeMetadata = options.includeMetadata ?? true;
    this.preserveRawData = options.preserveRawData ?? false;
  }

  /**
   * Transform Notion page into CanonicalObject
   */
  transform(page: NotionPage): CanonicalObject {
    const objectType = page.object_type || this.inferObjectType(page);
    const title = this.extractTitle(page);
    const body = this.extractBody(page);

    return {
      // Identifiers
      id: createCanonicalId('notion', this.workspace, objectType, page.id),
      platform: 'notion',
      object_type: objectType,

      // Core content
      title,
      body,

      // Actors
      actors: {
        created_by: page.created_by
          ? this.formatUserId(page.created_by.id, page.created_by.email)
          : undefined,
        participants: page.participants?.map((p) => this.formatUserId(p)) || undefined,
        updated_by: page.last_edited_by
          ? this.formatUserId(page.last_edited_by.id, page.last_edited_by.email)
          : undefined,
      },

      // Timestamps
      timestamps: {
        created_at: page.created_time,
        updated_at: page.last_edited_time,
      },

      // Relations
      relations: this.extractRelations(page),

      // Properties
      properties: {
        note_type: page.note_type,
        keywords: page.keywords || this.extractKeywords(title, body),
        parent_database: page.parent?.database_id,
        parent_page: page.parent?.page_id,
      },

      // Search text (auto-generated)
      search_text: this.generateSearchText(title, body, page.keywords),

      // Semantic hash for duplicate detection
      semantic_hash: generateSemanticHash({
        title,
        body,
        keywords: page.keywords || this.extractKeywords(title, body),
      }),

      // Metadata
      visibility: 'team',
      schema_version: 'v1.0',

      // Raw data (if requested)
      raw: this.preserveRawData ? (page as any) : undefined,
    };
  }

  /**
   * Transform multiple pages
   */
  transformBatch(pages: NotionPage[]): CanonicalObject[] {
    return pages.map((page) => this.transform(page));
  }

  /**
   * Infer object type from page content/title
   */
  private inferObjectType(page: NotionPage): NotionObjectType {
    const title = this.extractTitle(page).toLowerCase();

    if (title.includes('meeting') || title.includes('미팅')) {
      return 'meeting_note';
    }

    if (
      title.includes('feedback') ||
      title.includes('피드백') ||
      title.includes('interview') ||
      title.includes('인터뷰')
    ) {
      return 'feedback';
    }

    return 'page';
  }

  /**
   * Extract title from Notion page properties
   */
  private extractTitle(page: NotionPage): string {
    if (page.properties.title && Array.isArray(page.properties.title)) {
      return page.properties.title.map((t) => t.plain_text).join('');
    }

    // Try to find any text property that might be the title
    for (const [_key, value] of Object.entries(page.properties)) {
      if (Array.isArray(value) && value.length > 0 && value[0].plain_text) {
        return value.map((v) => v.plain_text).join('');
      }
    }

    return `Untitled (${page.id})`;
  }

  /**
   * Extract body from Notion page content
   */
  private extractBody(page: NotionPage): string {
    if (page.content) {
      return page.content;
    }

    // If no content field, try to extract from properties
    const propertyTexts: string[] = [];
    for (const [key, value] of Object.entries(page.properties)) {
      if (key !== 'title' && Array.isArray(value)) {
        const text = value.map((v) => v.plain_text).join('');
        if (text) {
          propertyTexts.push(`${key}: ${text}`);
        }
      }
    }

    return propertyTexts.join('\n') || 'No content available';
  }

  /**
   * Extract keywords from title and body
   */
  private extractKeywords(title: string, body: string): string[] {
    const text = `${title} ${body}`.toLowerCase();
    const keywords = new Set<string>();

    // Common feature keywords
    const featureKeywords = [
      'gmail',
      'slack',
      'discord',
      'email',
      'cc',
      'bcc',
      'inbox',
      'filter',
      'notification',
      'sync',
      'oauth',
      'auth',
      'ui',
      'bug',
      'feature',
      'todo',
      'task',
    ];

    for (const keyword of featureKeywords) {
      if (text.includes(keyword)) {
        keywords.add(keyword);
      }
    }

    // Extract Linear issue IDs
    const issueMatches = text.match(/\bTEN-\d+\b/gi);
    if (issueMatches) {
      issueMatches.forEach((match) => keywords.add(match.toUpperCase()));
    }

    return Array.from(keywords);
  }

  /**
   * Extract relations from page
   */
  private extractRelations(page: NotionPage): Record<string, any> {
    const relations: Record<string, any> = {};

    // Linked issues (if provided)
    if (page.linked_issues && page.linked_issues.length > 0) {
      relations.validated_by = page.linked_issues.map((issueId) =>
        createCanonicalId('linear', this.workspace, 'issue', issueId)
      );
    }

    return relations;
  }

  /**
   * Generate search text
   */
  private generateSearchText(title: string, body: string, keywords?: string[]): string {
    const parts = [title, body];
    if (keywords) {
      parts.push(keywords.join(' '));
    }
    return parts.join(' ');
  }

  /**
   * Format user ID to canonical format
   */
  private formatUserId(userId: string, email?: string): string {
    // If already in canonical format (user:...), return as is
    if (userId.startsWith('user:')) {
      return userId;
    }

    // Prefer email if available
    if (email) {
      return `user:${email}`;
    }

    // Otherwise use Notion user ID
    return `user:notion_${userId}`;
  }

  /**
   * Validate page before transformation
   */
  validatePage(page: NotionPage): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!page.id) {
      errors.push('Missing page id');
    }

    if (!page.created_time) {
      errors.push('Missing created_time');
    }

    if (!page.last_edited_time) {
      errors.push('Missing last_edited_time');
    }

    if (!page.properties || Object.keys(page.properties).length === 0) {
      errors.push('No properties in page');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
