/**
 * Generate realistic Zendesk sample data
 * Based on Zendesk REST API v2 from Phase 1 research
 */

import {
  randomInt,
  randomChoice,
  randomBoolean,
  randomPastDate,
  randomRecentDate,
  randomTitle,
  randomMarkdown,
  randomCommentBody,
  randomUser,
  generateZendeskTicketId,
  logProgress,
  // type MockUser,
} from './utils';

// =============================================================================
// Zendesk Types (matching REST API v2)
// =============================================================================

export interface ZendeskAttachment {
  id: number;
  file_name: string;
  content_url: string;
  content_type: string;
  size: number;
  thumbnails?: Array<{
    id: number;
    file_name: string;
    content_url: string;
  }>;
}

export interface ZendeskVia {
  channel: 'web' | 'email' | 'phone' | 'chat' | 'mobile' | 'api';
  source?: {
    from?: {
      address?: string;
      name?: string;
    };
    to?: {
      address?: string;
      name?: string;
    };
  };
}

export interface ZendeskComment {
  id: number;
  type: 'Comment' | 'VoiceComment';
  body: string;
  html_body: string;
  plain_body: string;
  public: boolean;
  author_id: number;
  attachments: ZendeskAttachment[];
  via: ZendeskVia;
  created_at: string;
}

export interface ZendeskCustomField {
  id: number;
  value: string | number | boolean | null;
}

export interface ZendeskTicket {
  id: number;
  url: string;
  external_id: string | null;

  // Content
  subject: string;
  description: string;
  type: 'incident' | 'question' | 'task' | 'problem' | null;
  priority: 'low' | 'normal' | 'high' | 'urgent' | null;
  status: 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed';

  // Actors
  requester_id: number;
  submitter_id: number;
  assignee_id: number | null;
  organization_id: number | null;

  // Categorization
  tags: string[];
  custom_fields: ZendeskCustomField[];

  // Comments
  comments: ZendeskComment[];

  // Satisfaction
  satisfaction_rating: {
    score: 'good' | 'bad' | null;
    comment?: string;
  } | null;

  // Via
  via: ZendeskVia;

  // Timestamps
  created_at: string;
  updated_at: string;
  due_at: string | null;

  // Metrics
  metric_set?: {
    reply_time_in_minutes: {
      business: number;
      calendar: number;
    };
    first_resolution_time_in_minutes: {
      business: number;
      calendar: number;
    };
  };
}

// =============================================================================
// Attachment Generator
// =============================================================================

function generateZendeskAttachment(index: number): ZendeskAttachment {
  const fileTypes = [
    { name: 'screenshot.png', type: 'image/png', sizeRange: [50000, 500000] },
    { name: 'document.pdf', type: 'application/pdf', sizeRange: [100000, 2000000] },
    { name: 'error-log.txt', type: 'text/plain', sizeRange: [1000, 50000] },
    { name: 'screenshot.jpg', type: 'image/jpeg', sizeRange: [50000, 500000] },
    { name: 'config.json', type: 'application/json', sizeRange: [500, 10000] },
  ];

  const fileType = randomChoice(fileTypes);

  return {
    id: 50000 + index,
    file_name: fileType.name,
    content_url: `https://cdn.zendesk.com/attachments/${50000 + index}/${fileType.name}`,
    content_type: fileType.type,
    size: randomInt(fileType.sizeRange[0], fileType.sizeRange[1]),
  };
}

// =============================================================================
// Comment Generator
// =============================================================================

function generateZendeskComment(index: number, isPublic: boolean): ZendeskComment {
  const body = randomCommentBody();
  const hasAttachments = randomBoolean(0.15);

  const channels: ZendeskVia['channel'][] = ['web', 'email', 'chat', 'mobile'];
  const channel = randomChoice(channels);

  return {
    id: 100000 + index,
    type: 'Comment',
    body,
    html_body: `<p>${body}</p>`,
    plain_body: body,
    public: isPublic,
    author_id: randomInt(1000, 9999),
    attachments: hasAttachments ? [generateZendeskAttachment(index)] : [],
    via: {
      channel,
      ...(channel === 'email' && {
        source: {
          from: {
            address: randomUser().email,
            name: randomUser().displayName,
          },
        },
      }),
    },
    created_at: randomRecentDate(30),
  };
}

// =============================================================================
// Ticket Generator
// =============================================================================

export function generateZendeskTicket(index: number): ZendeskTicket {
  const id = generateZendeskTicketId(index);
  const createdAt = randomPastDate(365);
  const updatedAt = randomRecentDate(60);

  // Type distribution
  const types: ZendeskTicket['type'][] = [
    'incident',
    'incident',
    'incident', // 50% incidents
    'question',
    'question', // 33% questions
    'task', // 17% tasks
    'problem',
  ];
  const type = randomChoice(types);

  // Priority distribution
  const priorities: ZendeskTicket['priority'][] = [
    'low',
    'normal',
    'normal',
    'normal', // 50% normal
    'high',
    'high', // 33% high
    'urgent', // 17% urgent
  ];
  const priority = randomChoice(priorities);

  // Status distribution (realistic workflow)
  const statuses: ZendeskTicket['status'][] = [
    'new',
    'new',
    'open',
    'open',
    'open',
    'open',
    'pending',
    'solved',
    'solved',
    'closed',
  ];
  const status = randomChoice(statuses);

  // Comments (0-30, weighted)
  const commentCountWeights = [
    { count: 0, weight: 0.1 },
    { count: randomInt(1, 5), weight: 0.4 },
    { count: randomInt(6, 15), weight: 0.3 },
    { count: randomInt(16, 30), weight: 0.2 },
  ];

  let commentRandom = Math.random();
  let commentCount = 0;
  for (const { count, weight } of commentCountWeights) {
    commentRandom -= weight;
    if (commentRandom <= 0) {
      commentCount = count;
      break;
    }
  }

  const comments = Array.from(
    { length: commentCount },
    (_, i) => generateZendeskComment(i, randomBoolean(0.8)) // 80% public
  );

  // Tags (industry-specific)
  const tagPool = [
    'billing',
    'technical',
    'account',
    'feature-request',
    'bug',
    'urgent',
    'vip',
    'escalated',
    'needs-attention',
    'follow-up',
  ];
  const tags = randomBoolean(0.8)
    ? Array.from({ length: randomInt(1, 4) }, () => randomChoice(tagPool))
    : [];

  // Satisfaction rating (40% have rating, only for solved/closed)
  const hasSatisfactionRating = ['solved', 'closed'].includes(status) && randomBoolean(0.4);
  const satisfactionRating = hasSatisfactionRating
    ? {
        score: randomChoice(['good', 'good', 'good', 'bad']) as 'good' | 'bad',
        comment: randomBoolean(0.5) ? randomCommentBody() : undefined,
      }
    : null;

  // Via channel
  const channels: ZendeskVia['channel'][] = ['web', 'email', 'phone', 'chat', 'mobile', 'api'];
  const via: ZendeskVia = {
    channel: randomChoice(channels),
  };

  // Custom fields
  const customFields: ZendeskCustomField[] = [
    { id: 360001, value: randomChoice(['production', 'staging', 'development']) },
    { id: 360002, value: randomChoice(['web', 'mobile', 'desktop', 'api']) },
    { id: 360003, value: randomBoolean(0.3) },
  ];

  return {
    id,
    url: `https://acme.zendesk.com/api/v2/tickets/${id}.json`,
    external_id: randomBoolean(0.2) ? `ext-${randomInt(1000, 9999)}` : null,

    subject: randomTitle(),
    description: randomMarkdown(),
    type,
    priority,
    status,

    requester_id: randomInt(1000, 9999),
    submitter_id: randomInt(1000, 9999),
    assignee_id: randomBoolean(0.7) ? randomInt(1000, 9999) : null,
    organization_id: randomBoolean(0.6) ? randomInt(100, 999) : null,

    tags: Array.from(new Set(tags)), // Remove duplicates
    custom_fields: customFields,

    comments,

    satisfaction_rating: satisfactionRating,

    via,

    created_at: createdAt,
    updated_at: updatedAt,
    due_at: randomBoolean(0.3) ? randomRecentDate(60) : null,

    // Metrics (only for resolved tickets)
    metric_set: ['solved', 'closed'].includes(status)
      ? {
          reply_time_in_minutes: {
            business: randomInt(30, 1440),
            calendar: randomInt(60, 2880),
          },
          first_resolution_time_in_minutes: {
            business: randomInt(120, 4320),
            calendar: randomInt(240, 8640),
          },
        }
      : undefined,
  };
}

// =============================================================================
// Batch Generator
// =============================================================================

export interface ZendeskSampleConfig {
  count: number;
}

export async function generateZendeskSamples(
  config: ZendeskSampleConfig
): Promise<ZendeskTicket[]> {
  const { count } = config;
  const samples: ZendeskTicket[] = [];

  console.log(`\n🎫 Generating ${count} Zendesk ticket samples...`);

  for (let i = 0; i < count; i++) {
    samples.push(generateZendeskTicket(i));
    logProgress(i + 1, count, 'Tickets');
  }

  return samples;
}

// =============================================================================
// Statistics
// =============================================================================

export function analyzeZendeskSamples(samples: ZendeskTicket[]): void {
  console.log('\n📊 Zendesk Sample Statistics:');
  console.log(`  Total tickets: ${samples.length}`);

  const withComments = samples.filter((s) => s.comments.length > 0).length;
  console.log(
    `  Tickets with comments: ${withComments} (${((withComments / samples.length) * 100).toFixed(1)}%)`
  );

  const totalComments = samples.reduce((sum, s) => sum + s.comments.length, 0);
  console.log(`  Total comments: ${totalComments}`);
  console.log(`  Avg comments per ticket: ${(totalComments / samples.length).toFixed(1)}`);

  const byStatus = samples.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('\n  By status:');
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`    ${status}: ${count}`);
  });

  const byPriority = samples.reduce(
    (acc, s) => {
      const priority = s.priority || 'none';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('\n  By priority:');
  Object.entries(byPriority).forEach(([priority, count]) => {
    console.log(`    ${priority}: ${count}`);
  });

  const withAttachments = samples.filter((s) =>
    s.comments.some((c) => c.attachments.length > 0)
  ).length;
  console.log(`\n  Tickets with attachments: ${withAttachments}`);

  const withSatisfaction = samples.filter((s) => s.satisfaction_rating !== null).length;
  console.log(`  Tickets with satisfaction rating: ${withSatisfaction}`);

  console.log('');
}
