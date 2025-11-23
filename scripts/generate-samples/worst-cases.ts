/**
 * Generate worst-case scenarios for chunking experiments
 * These are intentionally challenging cases to test chunking strategies
 */

import type { LinearIssue, LinearComment } from './linear';
import { randomUser, randomLabels, randomPastDate, randomRecentDate } from './utils';
import type { ZendeskTicket, ZendeskComment } from './zendesk';

// =============================================================================
// Worst Case Interface
// =============================================================================

export interface WorstCase {
  case_id: string;
  description: string;
  challenge: string;
  platform: 'linear' | 'zendesk';
  category:
    | 'long_thread'
    | 'large_code_block'
    | 'deep_nesting'
    | 'many_attachments'
    | 'mixed_content'
    | 'deleted_content'
    | 'relational_complex';
  data: LinearIssue | ZendeskTicket;
}

// =============================================================================
// Worst Case Generators
// =============================================================================

/** WC-001: Long thread with 50+ comments */
function generateLongThreadCase(): WorstCase {
  const comments: LinearComment[] = Array.from({ length: 55 }, (_, i) => ({
    id: `comment-${i + 1}`,
    body: `Comment #${i + 1}: ${['I agree with this approach.', 'Can we also consider...', 'This is working as expected.', 'Found an issue:', 'Updated the PR.'][i % 5]}`,
    bodyData: `Comment #${i + 1}`,
    createdAt: randomRecentDate(30),
    updatedAt: randomRecentDate(30),
    editedAt: null,
    archivedAt: null,
    user: randomUser(),
    parent: null,
  }));

  const issue: LinearIssue = {
    id: 'worst-case-001',
    identifier: 'WC-001',
    title: 'Implement comprehensive authentication system',
    description: 'This is a major feature with extensive discussion.',
    priority: 1,
    estimate: 13,
    state: { id: 'state-3', name: 'In Progress', type: 'started', color: '#F2C94C', position: 3 },
    creator: randomUser(),
    assignee: randomUser(),
    labels: { nodes: randomLabels(3) },
    comments: {
      nodes: comments,
      pageInfo: { hasNextPage: false, endCursor: null },
    },
    parent: null,
    createdAt: randomPastDate(90),
    updatedAt: randomRecentDate(1),
    archivedAt: null,
    url: 'https://linear.app/acme/issue/WC-001',
  };

  return {
    case_id: 'WC-001',
    description: 'Linear issue with 55 comments',
    challenge: 'Long thread with multiple topics and participants',
    platform: 'linear',
    category: 'long_thread',
    data: issue,
  };
}

/** WC-002: 500-line code block */
function generateLargeCodeBlockCase(): WorstCase {
  const codeBlock = `\`\`\`typescript
// Authentication service implementation
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

${Array.from({ length: 450 }, (_, i) => `// Line ${i + 10}: Implementation detail...`).join('\n')}

export class AuthService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }
}
\`\`\``;

  const ticket: ZendeskTicket = {
    id: 20001,
    url: 'https://acme.zendesk.com/api/v2/tickets/20001.json',
    external_id: null,
    subject: 'Authentication service code review needed',
    description: `Please review this authentication service implementation.\n\n${codeBlock}`,
    type: 'task',
    priority: 'high',
    status: 'open',
    requester_id: 5001,
    submitter_id: 5001,
    assignee_id: 5002,
    organization_id: 501,
    tags: ['code-review', 'backend', 'security'],
    custom_fields: [{ id: 360001, value: 'production' }],
    comments: [],
    satisfaction_rating: null,
    via: { channel: 'web' },
    created_at: randomPastDate(30),
    updated_at: randomRecentDate(5),
    due_at: null,
  };

  return {
    case_id: 'WC-002',
    description: '500-line code block in Zendesk ticket',
    challenge: 'Large code snippet that should not be split mid-function',
    platform: 'zendesk',
    category: 'large_code_block',
    data: ticket,
  };
}

/** WC-003: Deep comment nesting (threaded discussion) */
function generateDeepNestingCase(): WorstCase {
  const comments: LinearComment[] = [
    {
      id: 'c1',
      body: 'Root comment',
      bodyData: 'Root comment',
      createdAt: randomRecentDate(30),
      updatedAt: randomRecentDate(30),
      editedAt: null,
      archivedAt: null,
      user: randomUser(),
      parent: null,
    },
    {
      id: 'c2',
      body: 'Reply to root',
      bodyData: 'Reply to root',
      createdAt: randomRecentDate(29),
      updatedAt: randomRecentDate(29),
      editedAt: null,
      archivedAt: null,
      user: randomUser(),
      parent: 'c1',
    },
    {
      id: 'c3',
      body: 'Reply to c2',
      bodyData: 'Reply to c2',
      createdAt: randomRecentDate(28),
      updatedAt: randomRecentDate(28),
      editedAt: null,
      archivedAt: null,
      user: randomUser(),
      parent: 'c2',
    },
    {
      id: 'c4',
      body: 'Reply to c3',
      bodyData: 'Reply to c3',
      createdAt: randomRecentDate(27),
      updatedAt: randomRecentDate(27),
      editedAt: null,
      archivedAt: null,
      user: randomUser(),
      parent: 'c3',
    },
    {
      id: 'c5',
      body: 'Reply to c4',
      bodyData: 'Reply to c4',
      createdAt: randomRecentDate(26),
      updatedAt: randomRecentDate(26),
      editedAt: null,
      archivedAt: null,
      user: randomUser(),
      parent: 'c4',
    },
    {
      id: 'c6',
      body: 'Reply to c5',
      bodyData: 'Reply to c5',
      createdAt: randomRecentDate(25),
      updatedAt: randomRecentDate(25),
      editedAt: null,
      archivedAt: null,
      user: randomUser(),
      parent: 'c5',
    },
    {
      id: 'c7',
      body: 'Reply to c6',
      bodyData: 'Reply to c6',
      createdAt: randomRecentDate(24),
      updatedAt: randomRecentDate(24),
      editedAt: null,
      archivedAt: null,
      user: randomUser(),
      parent: 'c6',
    },
    {
      id: 'c8',
      body: 'Reply to c7',
      bodyData: 'Reply to c7',
      createdAt: randomRecentDate(23),
      updatedAt: randomRecentDate(23),
      editedAt: null,
      archivedAt: null,
      user: randomUser(),
      parent: 'c7',
    },
  ];

  const issue: LinearIssue = {
    id: 'worst-case-003',
    identifier: 'WC-003',
    title: 'Design discussion: Architecture patterns',
    description: 'Discussion about which architecture pattern to use.',
    priority: 2,
    estimate: 5,
    state: { id: 'state-4', name: 'In Review', type: 'started', color: '#5E6AD2', position: 4 },
    creator: randomUser(),
    assignee: randomUser(),
    labels: { nodes: randomLabels(2) },
    comments: {
      nodes: comments,
      pageInfo: { hasNextPage: false, endCursor: null },
    },
    parent: null,
    createdAt: randomPastDate(30),
    updatedAt: randomRecentDate(1),
    archivedAt: null,
    url: 'https://linear.app/acme/issue/WC-003',
  };

  return {
    case_id: 'WC-003',
    description: '8-level deep comment threading',
    challenge: 'Preserving thread hierarchy and context',
    platform: 'linear',
    category: 'deep_nesting',
    data: issue,
  };
}

/** WC-004: Many attachments (15+ files) */
function generateManyAttachmentsCase(): WorstCase {
  const comments: ZendeskComment[] = [
    {
      id: 200001,
      type: 'Comment',
      body: 'Here are all the screenshots and logs.',
      html_body: '<p>Here are all the screenshots and logs.</p>',
      plain_body: 'Here are all the screenshots and logs.',
      public: true,
      author_id: 6001,
      attachments: Array.from({ length: 15 }, (_, i) => ({
        id: 60000 + i,
        file_name: `screenshot-${i + 1}.png`,
        content_url: `https://cdn.zendesk.com/attachments/${60000 + i}/screenshot-${i + 1}.png`,
        content_type: 'image/png',
        size: 125000 + i * 10000,
      })),
      via: { channel: 'email' },
      created_at: randomRecentDate(5),
    },
  ];

  const ticket: ZendeskTicket = {
    id: 20004,
    url: 'https://acme.zendesk.com/api/v2/tickets/20004.json',
    external_id: null,
    subject: 'UI broken on multiple pages - screenshots attached',
    description: 'The UI is completely broken across different browsers. Attaching screenshots.',
    type: 'incident',
    priority: 'urgent',
    status: 'open',
    requester_id: 6001,
    submitter_id: 6001,
    assignee_id: 6002,
    organization_id: 601,
    tags: ['ui', 'bug', 'urgent'],
    custom_fields: [{ id: 360001, value: 'production' }],
    comments,
    satisfaction_rating: null,
    via: { channel: 'email' },
    created_at: randomPastDate(5),
    updated_at: randomRecentDate(1),
    due_at: null,
  };

  return {
    case_id: 'WC-004',
    description: 'Zendesk ticket with 15 image attachments',
    challenge: 'Handling attachment metadata without bloating chunks',
    platform: 'zendesk',
    category: 'many_attachments',
    data: ticket,
  };
}

/** WC-005: Mixed content (code + text + lists + tables) */
function generateMixedContentCase(): WorstCase {
  const mixedContent = `## Problem Statement

Users are experiencing authentication failures when using SSO.

## Analysis

After investigating, I found the following issues:

1. Token expiration not handled correctly
2. Refresh token flow broken
3. Session persistence issues

### Code Investigation

\`\`\`typescript
async function refreshToken(token: string) {
  // This is the problematic code
  const decoded = jwt.verify(token, SECRET);
  return decoded;
}
\`\`\`

### Test Results

| Browser | Status | Error |
|---------|--------|-------|
| Chrome | ❌ Fail | Token expired |
| Firefox | ❌ Fail | Invalid signature |
| Safari | ✅ Pass | - |

## Proposed Solution

We need to:

- [ ] Fix token expiration handling
- [ ] Implement proper refresh flow
- [ ] Add session persistence
- [ ] Write comprehensive tests

### Implementation Plan

\`\`\`typescript
async function refreshToken(token: string) {
  try {
    const decoded = jwt.verify(token, SECRET);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return await getNewToken();
    }
    throw error;
  }
}
\`\`\`

## Additional Notes

This affects approximately **5,000 users** in production.`;

  const issue: LinearIssue = {
    id: 'worst-case-005',
    identifier: 'WC-005',
    title: 'Fix SSO authentication failures',
    description: mixedContent,
    priority: 1,
    estimate: 8,
    state: { id: 'state-3', name: 'In Progress', type: 'started', color: '#F2C94C', position: 3 },
    creator: randomUser(),
    assignee: randomUser(),
    labels: { nodes: randomLabels(4) },
    comments: {
      nodes: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
    parent: null,
    createdAt: randomPastDate(15),
    updatedAt: randomRecentDate(2),
    archivedAt: null,
    url: 'https://linear.app/acme/issue/WC-005',
  };

  return {
    case_id: 'WC-005',
    description: 'Mixed content: code, tables, lists, and prose',
    challenge: 'Preserving formatting and semantic boundaries',
    platform: 'linear',
    category: 'mixed_content',
    data: issue,
  };
}

// =============================================================================
// Generate All Worst Cases
// =============================================================================

export function generateAllWorstCases(): WorstCase[] {
  console.log('\n⚠️  Generating worst-case scenarios...\n');

  const cases: WorstCase[] = [
    generateLongThreadCase(),
    generateLargeCodeBlockCase(),
    generateDeepNestingCase(),
    generateManyAttachmentsCase(),
    generateMixedContentCase(),
  ];

  // Add more variants (20 total)
  const additionalCases = [
    // More long threads
    ...Array.from({ length: 3 }, (_, i) => {
      const base = generateLongThreadCase();
      return {
        ...base,
        case_id: `WC-${String(6 + i).padStart(3, '0')}`,
        description: `Linear issue with ${40 + i * 10} comments (variant ${i + 1})`,
      };
    }),

    // More code blocks
    ...Array.from({ length: 3 }, (_, i) => {
      const base = generateLargeCodeBlockCase();
      return {
        ...base,
        case_id: `WC-${String(9 + i).padStart(3, '0')}`,
        description: `Large code block variant ${i + 1}`,
      };
    }),

    // More nested threads
    ...Array.from({ length: 2 }, (_, i) => {
      const base = generateDeepNestingCase();
      return {
        ...base,
        case_id: `WC-${String(12 + i).padStart(3, '0')}`,
        description: `Deep nesting variant ${i + 1}`,
      };
    }),

    // More attachment cases
    ...Array.from({ length: 2 }, (_, i) => {
      const base = generateManyAttachmentsCase();
      return {
        ...base,
        case_id: `WC-${String(14 + i).padStart(3, '0')}`,
        description: `Many attachments variant ${i + 1}`,
      };
    }),

    // More mixed content
    ...Array.from({ length: 5 }, (_, i) => {
      const base = generateMixedContentCase();
      return {
        ...base,
        case_id: `WC-${String(16 + i).padStart(3, '0')}`,
        description: `Mixed content variant ${i + 1}`,
      };
    }),
  ];

  cases.push(...additionalCases);

  console.log(`✅ Generated ${cases.length} worst-case scenarios\n`);

  // Print summary
  const byCategory = cases.reduce(
    (acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('📊 Worst Cases by Category:');
  Object.entries(byCategory).forEach(([category, count]) => {
    console.log(`  ${category}: ${count}`);
  });

  console.log('');

  return cases;
}
