/**
 * Type definitions for Graph Dataset Generator V2
 * Extends Phase 5 work with Slack threads and relation ground truth
 */

// =============================================================================
// Re-export existing types from Phase 5
// =============================================================================

export type { MockUser, MockLabel } from '../generate-samples/utils';

export type {
  ZendeskTicket,
  ZendeskComment,
  ZendeskAttachment,
  ZendeskVia,
  ZendeskCustomField,
} from '../generate-samples/zendesk';

export type { LinearIssue, LinearComment, LinearWorkflowState } from '../generate-samples/linear';

// =============================================================================
// New Types for Graph Dataset
// =============================================================================

/**
 * Company represents a customer/account in the system
 * Maps to Zendesk Organization
 */
export interface Company {
  id: string; // "company_1"
  name: string; // "Acme Corp"
  tier: 'enterprise' | 'growth' | 'startup';
  employee_count: number; // Based on tier
  industry: string; // "SaaS", "E-commerce", etc.
  created_at: string;
  metadata?: Record<string, any>;
}

/**
 * User represents both internal team members and customer users
 * Extended from MockUser with additional fields
 */
export interface User {
  id: string; // "user_1"
  name: string; // "Alice Smith"
  email: string;
  role: 'customer' | 'support' | 'engineering' | 'sales' | 'product';
  company_id?: string; // For customer users
  avatar_url?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

/**
 * Slack message in a thread
 */
export interface SlackMessage {
  ts: string; // Slack timestamp (unique ID within channel)
  user_id: string; // Who sent this message
  text: string; // Message content
  thread_ts?: string; // Parent message ts if this is a reply
  reactions?: Array<{
    name: string; // e.g., "thumbsup", "eyes"
    count: number;
    users: string[];
  }>;
  attachments?: Array<{
    // For bot messages (e.g., Zendesk bot)
    title?: string;
    text?: string;
    fields?: Array<{ title: string; value: string; short?: boolean }>;
    footer?: string;
    color?: string;
  }>;
  bot_id?: string; // If sent by a bot
  created_at: string;
}

/**
 * Slack thread represents a conversation
 * Core innovation: captures decision context missing from Zendesk/Linear
 */
export interface SlackThread {
  ts: string; // Thread timestamp (root message ts)
  channel: string; // Channel ID or name
  messages: SlackMessage[]; // All messages in thread (root + replies)

  // Relations (ground truth)
  triggered_by_ticket?: string; // Zendesk ticket ID that started this thread
  resulted_in_issue?: string; // Linear issue ID created from this thread

  // Participants
  participants: string[]; // User IDs who participated

  // Context
  keywords: string[]; // Extracted keywords for similarity
  sentiment?: 'positive' | 'neutral' | 'concerned' | 'urgent';

  // Decision tracking
  decision_made: boolean; // Did someone decide to create Linear issue?
  decided_by?: string; // User ID who made decision
  decided_at?: string; // When decision was made

  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

/**
 * Relation type for the knowledge graph
 * These are the "ground truth" relations we'll validate against
 */
export type RelationType =
  | 'triggered_by' // Slack thread triggered by Zendesk ticket
  | 'resulted_in' // Slack thread resulted in Linear issue
  | 'belongs_to' // Ticket/Issue belongs to Company
  | 'assigned_to' // Issue assigned to User
  | 'created_by' // Object created by User
  | 'decided_by' // Decision made by User
  | 'participated_in' // User participated in Slack thread
  | 'similar_to' // Objects are similar (keyword overlap)
  | 'duplicate_of' // Potential duplicate
  | 'related_to'; // Generic relation

/**
 * Relation hint for validation
 * Format: "platform|workspace|object_type|id"
 * Examples:
 *   - "zendesk|momo|ticket|10001"
 *   - "slack|momo|thread|1732406400.123456"
 *   - "linear|momo|issue|ENG-101"
 */
export interface RelationHint {
  from_id: string; // Source object ID
  to_id: string; // Target object ID
  type: RelationType;

  // Metadata about the relation
  confidence?: number; // 0-1 for inferred relations
  source: 'explicit' | 'inferred' | 'computed';
  metadata?: Record<string, any>;

  created_at: string;
}

/**
 * Complete graph dataset
 */
export interface GraphDataset {
  metadata: {
    scenario: string; // "normal", "sales_heavy", etc.
    generated_at: string;
    version: string; // "2.0"
    stats: {
      companies: number;
      users: number;
      zendesk_tickets: number;
      slack_threads: number;
      linear_issues: number;
      relations: number;
    };
  };

  // Core entities
  companies: Company[];
  users: User[];

  // Platform data
  zendesk_tickets: ZendeskTicket[];
  slack_threads: SlackThread[];
  linear_issues: LinearIssue[];

  // Relations (ground truth)
  relations: RelationHint[];
}

/**
 * Scenario configuration
 */
export interface ScenarioConfig {
  name: string;
  description: string;

  // Entity counts
  companies: number;
  users: {
    customer: number;
    support: number;
    engineering: number;
    sales: number;
    product: number;
  };

  // Data generation params
  zendesk: {
    tickets: number;
    comments_per_ticket: { min: number; max: number };
  };

  slack: {
    thread_rate: number; // % of tickets that trigger Slack threads
    messages_per_thread: { min: number; max: number };
    decision_rate: number; // % of threads that result in decisions
  };

  linear: {
    issue_rate: number; // % of decisions that create Linear issues
    comments_per_issue: { min: number; max: number };
    sub_issue_rate: number; // % of issues that spawn sub-issues
  };

  // Pattern params
  patterns?: {
    recurring_issue_rate: number; // % of issues that are recurring
    similar_keywords: string[][]; // Groups of related keywords
    spike_days?: number[]; // Days with traffic spikes
  };
}
