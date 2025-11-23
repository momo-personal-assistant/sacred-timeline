/**
 * Generate realistic Linear sample data
 * Based on Linear GraphQL API schema from Phase 1 research
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
  randomLabels,
  generateLinearIssueId,
  generateLinearIdentifier,
  logProgress,
  type MockUser,
  type MockLabel,
} from './utils';

// =============================================================================
// Linear Types (matching GraphQL schema)
// =============================================================================

export interface LinearComment {
  id: string;
  body: string;
  bodyData: string; // ProseMirror format (same as body for simplicity)
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  archivedAt: string | null;
  user: MockUser | null;
  parent: string | null; // For threaded comments
}

export interface LinearWorkflowState {
  id: string;
  name: string;
  type: 'unstarted' | 'started' | 'completed' | 'canceled';
  color: string;
  position: number;
}

export interface LinearIssue {
  id: string;
  identifier: string; // e.g., "ENG-123"
  title: string;
  description: string | null;
  priority: number; // 0-4 (0 = none, 1 = urgent, 2 = high, 3 = normal, 4 = low)
  estimate: number | null; // Story points

  // State
  state: LinearWorkflowState;

  // Users
  creator: MockUser;
  assignee: MockUser | null;

  // Labels
  labels: {
    nodes: MockLabel[];
  };

  // Comments
  comments: {
    nodes: LinearComment[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };

  // Relations
  parent: { id: string; identifier: string } | null; // For sub-issues

  // Timestamps
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;

  // URLs
  url: string;
}

// =============================================================================
// Workflow States
// =============================================================================

const WORKFLOW_STATES: LinearWorkflowState[] = [
  { id: 'state-1', name: 'Backlog', type: 'unstarted', color: '#95A2B3', position: 1 },
  { id: 'state-2', name: 'Todo', type: 'unstarted', color: '#E2E2E2', position: 2 },
  { id: 'state-3', name: 'In Progress', type: 'started', color: '#F2C94C', position: 3 },
  { id: 'state-4', name: 'In Review', type: 'started', color: '#5E6AD2', position: 4 },
  { id: 'state-5', name: 'Done', type: 'completed', color: '#5E6AD2', position: 5 },
  { id: 'state-6', name: 'Canceled', type: 'canceled', color: '#95A2B3', position: 6 },
];

// =============================================================================
// Comment Generator
// =============================================================================

function generateLinearComment(index: number, _issueCreatedAt: string): LinearComment {
  const createdAt = randomRecentDate(30);
  const editedAt = randomBoolean(0.2) ? randomRecentDate(15) : null;

  return {
    id: `comment-${index + 1}`,
    body: randomCommentBody(),
    bodyData: randomCommentBody(), // Same as body (ProseMirror would be complex)
    createdAt,
    updatedAt: editedAt || createdAt,
    editedAt,
    archivedAt: randomBoolean(0.05) ? randomRecentDate(10) : null,
    user: randomUser(),
    parent: index > 0 && randomBoolean(0.3) ? `comment-${randomInt(1, index)}` : null,
  };
}

// =============================================================================
// Issue Generator
// =============================================================================

export function generateLinearIssue(index: number, parentIssue?: LinearIssue): LinearIssue {
  const id = generateLinearIssueId(index);
  const identifier = generateLinearIdentifier(index);
  const createdAt = randomPastDate(365);
  const updatedAt = randomRecentDate(60);

  // State distribution (realistic)
  const stateWeights = [0.15, 0.2, 0.35, 0.15, 0.1, 0.05];
  let random = Math.random();
  let stateIndex = 0;
  for (let i = 0; i < stateWeights.length; i++) {
    random -= stateWeights[i];
    if (random <= 0) {
      stateIndex = i;
      break;
    }
  }
  const state = WORKFLOW_STATES[stateIndex];

  // Priority distribution (realistic)
  const priorities = [0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4];
  const priority = randomChoice(priorities);

  // Assignee (80% have assignee)
  const assignee = randomBoolean(0.8) ? randomUser() : null;

  // Comments (0-50, weighted towards fewer)
  const commentCountWeights = [
    { count: 0, weight: 0.2 },
    { count: randomInt(1, 5), weight: 0.4 },
    { count: randomInt(6, 15), weight: 0.25 },
    { count: randomInt(16, 30), weight: 0.1 },
    { count: randomInt(31, 50), weight: 0.05 },
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

  const comments = Array.from({ length: commentCount }, (_, i) =>
    generateLinearComment(i, createdAt)
  );

  return {
    id,
    identifier,
    title: randomTitle(),
    description: randomBoolean(0.9) ? randomMarkdown() : null,
    priority,
    estimate: randomBoolean(0.6) ? randomChoice([1, 2, 3, 5, 8, 13]) : null,

    state,

    creator: randomUser(),
    assignee,

    labels: {
      nodes: randomLabels(4),
    },

    comments: {
      nodes: comments,
      pageInfo: {
        hasNextPage: comments.length > 50,
        endCursor: comments.length > 0 ? `cursor-${comments[comments.length - 1].id}` : null,
      },
    },

    parent: parentIssue ? { id: parentIssue.id, identifier: parentIssue.identifier } : null,

    createdAt,
    updatedAt,
    archivedAt: state.type === 'canceled' || randomBoolean(0.05) ? randomRecentDate(30) : null,

    url: `https://linear.app/acme/issue/${identifier}`,
  };
}

// =============================================================================
// Batch Generator
// =============================================================================

export interface LinearSampleConfig {
  count: number;
  includeSubIssues: boolean;
}

export async function generateLinearSamples(config: LinearSampleConfig): Promise<LinearIssue[]> {
  const { count, includeSubIssues } = config;
  const samples: LinearIssue[] = [];

  console.log(`\n🔷 Generating ${count} Linear issue samples...`);

  // Generate main issues
  for (let i = 0; i < count; i++) {
    samples.push(generateLinearIssue(i));
    logProgress(i + 1, count, 'Main issues');
  }

  // Generate sub-issues (10% of main issues)
  if (includeSubIssues) {
    const subIssueCount = Math.floor(count * 0.1);
    console.log(`\n🔷 Generating ${subIssueCount} sub-issues...`);

    for (let i = 0; i < subIssueCount; i++) {
      const parentIssue = randomChoice(samples);
      const subIssue = generateLinearIssue(count + i, parentIssue);
      samples.push(subIssue);
      logProgress(i + 1, subIssueCount, 'Sub-issues');
    }
  }

  return samples;
}

// =============================================================================
// Statistics
// =============================================================================

export function analyzeLinearSamples(samples: LinearIssue[]): void {
  console.log('\n📊 Linear Sample Statistics:');
  console.log(`  Total issues: ${samples.length}`);

  const withComments = samples.filter((s) => s.comments.nodes.length > 0).length;
  console.log(
    `  Issues with comments: ${withComments} (${((withComments / samples.length) * 100).toFixed(1)}%)`
  );

  const totalComments = samples.reduce((sum, s) => sum + s.comments.nodes.length, 0);
  console.log(`  Total comments: ${totalComments}`);
  console.log(`  Avg comments per issue: ${(totalComments / samples.length).toFixed(1)}`);

  const withSubIssues = samples.filter((s) => s.parent !== null).length;
  console.log(`  Sub-issues: ${withSubIssues}`);

  const archived = samples.filter((s) => s.archivedAt !== null).length;
  console.log(`  Archived: ${archived}`);

  const byState = samples.reduce(
    (acc, s) => {
      acc[s.state.name] = (acc[s.state.name] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('\n  By state:');
  Object.entries(byState).forEach(([state, count]) => {
    console.log(`    ${state}: ${count}`);
  });

  console.log('');
}
