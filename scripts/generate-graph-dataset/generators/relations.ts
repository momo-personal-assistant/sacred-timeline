/**
 * Relation builder for graph datasets
 * Creates "ground truth" relations that validate our inference logic
 */

import type {
  RelationHint,
  RelationType,
  ZendeskTicket,
  SlackThread,
  LinearIssue,
  Company,
  User,
} from '../types';

// =============================================================================
// Relation ID Formatters
// =============================================================================

/**
 * Format a canonical object ID for relations
 * Format: "platform|workspace|object_type|id"
 */
function formatRelationId(
  platform: 'zendesk' | 'slack' | 'linear' | 'company' | 'user',
  objectType: string,
  id: string
): string {
  return `${platform}|momo|${objectType}|${id}`;
}

function zendeskTicketId(ticketId: number | string): string {
  return formatRelationId('zendesk', 'ticket', String(ticketId));
}

function slackThreadId(threadTs: string): string {
  return formatRelationId('slack', 'thread', threadTs);
}

function linearIssueId(issueIdentifier: string): string {
  return formatRelationId('linear', 'issue', issueIdentifier);
}

function companyId(id: string): string {
  return formatRelationId('company', 'company', id);
}

function userId(id: string): string {
  return formatRelationId('user', 'user', id);
}

// =============================================================================
// Relation Creation Helpers
// =============================================================================

function createRelation(
  from_id: string,
  to_id: string,
  type: RelationType,
  source: RelationHint['source'],
  confidence?: number,
  metadata?: Record<string, any>
): RelationHint {
  return {
    from_id,
    to_id,
    type,
    source,
    confidence,
    metadata,
    created_at: new Date().toISOString(),
  };
}

// =============================================================================
// Relation Builders
// =============================================================================

/**
 * Build Zendesk → Slack relations
 * Source: explicit (thread.triggered_by_ticket)
 */
export function buildZendeskToSlackRelations(threads: SlackThread[]): RelationHint[] {
  const relations: RelationHint[] = [];

  for (const thread of threads) {
    if (thread.triggered_by_ticket) {
      relations.push(
        createRelation(
          slackThreadId(thread.ts),
          zendeskTicketId(thread.triggered_by_ticket),
          'triggered_by',
          'explicit',
          1.0,
          {
            zendesk_ticket_id: thread.triggered_by_ticket,
            slack_thread_ts: thread.ts,
          }
        )
      );
    }
  }

  return relations;
}

/**
 * Build Slack → Linear relations
 * Source: explicit (thread.resulted_in_issue)
 */
export function buildSlackToLinearRelations(
  threads: SlackThread[],
  issues: LinearIssue[]
): RelationHint[] {
  const relations: RelationHint[] = [];

  for (const thread of threads) {
    if (thread.resulted_in_issue) {
      const issue = issues.find((i) => i.id === thread.resulted_in_issue);
      if (issue) {
        relations.push(
          createRelation(
            slackThreadId(thread.ts),
            linearIssueId(issue.identifier),
            'resulted_in',
            'explicit',
            1.0,
            {
              slack_thread_ts: thread.ts,
              linear_issue_id: issue.id,
              linear_identifier: issue.identifier,
            }
          )
        );
      }
    }
  }

  return relations;
}

/**
 * Build Company relations
 * Source: explicit (belongs_to)
 */
export function buildCompanyRelations(params: {
  tickets: ZendeskTicket[];
  issues: LinearIssue[];
  users: User[];
  companies: Company[];
}): RelationHint[] {
  const relations: RelationHint[] = [];
  const { tickets, issues, users, companies: _companies } = params;

  // Tickets → Company (based on organization_id or requester)
  for (const ticket of tickets) {
    // In our mock data, we can infer company from requester_id
    // In real data, this would be ticket.organization_id
    const requester = users.find((u) => String(u.id) === `user_${ticket.requester_id}`);
    if (requester?.company_id) {
      relations.push(
        createRelation(
          zendeskTicketId(ticket.id),
          companyId(requester.company_id),
          'belongs_to',
          'explicit',
          1.0,
          {
            company_id: requester.company_id,
            requester_id: requester.id,
          }
        )
      );
    }
  }

  // Issues → Company (inferred from Slack thread → ticket → company)
  // This is more indirect, so confidence is lower
  for (const _issue of issues) {
    // We'll handle this in the full relation builder
  }

  // Users → Company (explicit for customer users)
  for (const user of users) {
    if (user.company_id) {
      relations.push(
        createRelation(userId(user.id), companyId(user.company_id), 'belongs_to', 'explicit', 1.0, {
          company_id: user.company_id,
        })
      );
    }
  }

  return relations;
}

/**
 * Build User assignment/participation relations
 */
export function buildUserRelations(params: {
  tickets: ZendeskTicket[];
  threads: SlackThread[];
  issues: LinearIssue[];
  users: User[];
}): RelationHint[] {
  const relations: RelationHint[] = [];
  const { tickets: _tickets, threads, issues, users: _users } = params;

  // Slack thread participants
  for (const thread of threads) {
    for (const participantId of thread.participants) {
      relations.push(
        createRelation(
          userId(participantId),
          slackThreadId(thread.ts),
          'participated_in',
          'explicit',
          1.0,
          {
            thread_ts: thread.ts,
          }
        )
      );
    }

    // Decision maker
    if (thread.decided_by) {
      relations.push(
        createRelation(
          userId(thread.decided_by),
          slackThreadId(thread.ts),
          'decided_by',
          'explicit',
          1.0,
          {
            thread_ts: thread.ts,
            decided_at: thread.decided_at,
          }
        )
      );
    }
  }

  // Linear issue assignees
  for (const _issue of issues) {
    if (issue.assignee) {
      relations.push(
        createRelation(
          linearIssueId(issue.identifier),
          userId(issue.assignee.id),
          'assigned_to',
          'explicit',
          1.0,
          {
            issue_id: issue.id,
            assignee_id: issue.assignee.id,
          }
        )
      );
    }

    // Creator
    relations.push(
      createRelation(
        linearIssueId(issue.identifier),
        userId(issue.creator.id),
        'created_by',
        'explicit',
        1.0,
        {
          issue_id: issue.id,
          creator_id: issue.creator.id,
        }
      )
    );
  }

  return relations;
}

/**
 * Build similarity relations based on keyword overlap
 * Source: computed (keyword matching)
 */
export function buildSimilarityRelations(
  threads: SlackThread[],
  minKeywordOverlap: number = 2
): RelationHint[] {
  const relations: RelationHint[] = [];

  // Compare each thread with every other thread
  for (let i = 0; i < threads.length; i++) {
    for (let j = i + 1; j < threads.length; j++) {
      const thread1 = threads[i];
      const thread2 = threads[j];

      // Calculate keyword overlap
      const overlap = thread1.keywords.filter((k) => thread2.keywords.includes(k));

      if (overlap.length >= minKeywordOverlap) {
        const confidence =
          overlap.length / Math.max(thread1.keywords.length, thread2.keywords.length);

        relations.push(
          createRelation(
            slackThreadId(thread1.ts),
            slackThreadId(thread2.ts),
            'similar_to',
            'computed',
            confidence,
            {
              shared_keywords: overlap,
              keyword_overlap_count: overlap.length,
            }
          )
        );
      }
    }
  }

  return relations;
}

// =============================================================================
// Main Relation Builder
// =============================================================================

/**
 * Build all relations for a graph dataset
 */
export function buildRelations(params: {
  tickets: ZendeskTicket[];
  threads: SlackThread[];
  issues: LinearIssue[];
  companies: Company[];
  users: User[];
}): RelationHint[] {
  const { tickets, threads, issues, companies, users } = params;

  console.log('\n🔗 Building relations...\n');

  // 1. Zendesk → Slack
  const zendeskSlackRelations = buildZendeskToSlackRelations(threads);
  console.log(`   Zendesk → Slack: ${zendeskSlackRelations.length}`);

  // 2. Slack → Linear
  const slackLinearRelations = buildSlackToLinearRelations(threads, issues);
  console.log(`   Slack → Linear: ${slackLinearRelations.length}`);

  // 3. Company relations
  const companyRelations = buildCompanyRelations({
    tickets,
    issues,
    users,
    companies,
  });
  console.log(`   Company relations: ${companyRelations.length}`);

  // 4. User relations
  const userRelations = buildUserRelations({
    tickets,
    threads,
    issues,
    users,
  });
  console.log(`   User relations: ${userRelations.length}`);

  // 5. Similarity relations
  const similarityRelations = buildSimilarityRelations(threads);
  console.log(`   Similarity relations: ${similarityRelations.length}`);

  const allRelations = [
    ...zendeskSlackRelations,
    ...slackLinearRelations,
    ...companyRelations,
    ...userRelations,
    ...similarityRelations,
  ];

  console.log(`\n   Total relations: ${allRelations.length}`);

  return allRelations;
}

/**
 * Analyze relations for validation
 */
export function analyzeRelations(relations: RelationHint[]): void {
  console.log('\n📊 Relation Analysis:\n');

  // Group by type
  const byType = relations.reduce(
    (acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('   By type:');
  Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`      ${type}: ${count}`);
    });

  // Group by source
  const bySource = relations.reduce(
    (acc, r) => {
      acc[r.source] = (acc[r.source] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('\n   By source:');
  Object.entries(bySource).forEach(([source, count]) => {
    console.log(`      ${source}: ${count}`);
  });

  // Average confidence
  const withConfidence = relations.filter((r) => r.confidence !== undefined);
  const avgConfidence =
    withConfidence.length > 0
      ? withConfidence.reduce((sum, r) => sum + (r.confidence || 0), 0) / withConfidence.length
      : 0;

  console.log(`\n   Average confidence: ${avgConfidence.toFixed(3)}`);
}
