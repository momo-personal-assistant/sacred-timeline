/**
 * Utility functions for generating realistic sample data
 */

// =============================================================================
// Random Generators
// =============================================================================

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomChoice<T>(array: T[]): T {
  return array[randomInt(0, array.length - 1)];
}

export function randomBoolean(probability: number = 0.5): boolean {
  return Math.random() < probability;
}

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// =============================================================================
// Date Generators
// =============================================================================

export function randomPastDate(daysAgo: number = 365): string {
  const now = Date.now();
  const pastDate = now - randomInt(0, daysAgo * 24 * 60 * 60 * 1000);
  return new Date(pastDate).toISOString();
}

export function randomRecentDate(daysAgo: number = 30): string {
  return randomPastDate(daysAgo);
}

export function randomFutureDate(daysAhead: number = 30): string {
  const now = Date.now();
  const futureDate = now + randomInt(0, daysAhead * 24 * 60 * 60 * 1000);
  return new Date(futureDate).toISOString();
}

// =============================================================================
// Text Generators
// =============================================================================

const FIRST_NAMES = [
  'Alice',
  'Bob',
  'Carol',
  'David',
  'Eve',
  'Frank',
  'Grace',
  'Henry',
  'Iris',
  'Jack',
  'Kate',
  'Leo',
  'Mary',
  'Nathan',
  'Olivia',
  'Peter',
  'Quinn',
  'Rachel',
  'Sam',
  'Tina',
  'Uma',
  'Victor',
  'Wendy',
  'Xander',
];

const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
];

const FEATURE_WORDS = [
  'authentication',
  'authorization',
  'validation',
  'caching',
  'logging',
  'monitoring',
  'search',
  'filtering',
  'pagination',
  'notification',
  'upload',
  'download',
  'export',
  'import',
  'integration',
  'API',
  'dashboard',
  'analytics',
  'reporting',
  'settings',
  'profile',
];

const COMPONENT_WORDS = [
  'login page',
  'dashboard',
  'user profile',
  'settings panel',
  'admin console',
  'navigation bar',
  'sidebar',
  'modal dialog',
  'form validation',
  'API endpoint',
  'database query',
  'caching layer',
  'authentication service',
  'file storage',
  'email service',
  'notification system',
  'search index',
  'webhook handler',
];

const BUG_WORDS = [
  'crash',
  'memory leak',
  'race condition',
  'null pointer',
  'timeout',
  'error',
  'exception',
  'incorrect behavior',
  'UI glitch',
  'data corruption',
  'performance issue',
  'security vulnerability',
  'broken link',
  'infinite loop',
];

const TECH_WORDS = [
  'TypeScript',
  'React',
  'Node.js',
  'PostgreSQL',
  'Redis',
  'Docker',
  'Kubernetes',
  'AWS',
  'GraphQL',
  'REST API',
  'WebSocket',
  'JWT',
  'OAuth',
  'SAML',
  'Microservices',
  'Serverless',
  'CI/CD',
  'Terraform',
];

export function randomName(): string {
  const first = randomChoice(FIRST_NAMES);
  const last = randomChoice(LAST_NAMES);
  return `${first} ${last}`;
}

export function randomEmail(): string {
  const first = randomChoice(FIRST_NAMES).toLowerCase();
  const last = randomChoice(LAST_NAMES).toLowerCase();
  const domains = ['example.com', 'acme.com', 'test.io', 'demo.dev'];
  return `${first}.${last}@${randomChoice(domains)}`;
}

export function randomTitle(): string {
  const templates = [
    `Add {feature} to {component}`,
    `Fix {bug} in {component}`,
    `Refactor {component} for better performance`,
    `Implement {feature} using {tech}`,
    `Update {component} to support {feature}`,
    `Remove deprecated {feature} from {component}`,
    `Optimize {component} performance`,
    `Add tests for {component}`,
    `Document {feature} API`,
    `Improve {component} error handling`,
  ];

  const template = randomChoice(templates);
  return template
    .replace('{feature}', randomChoice(FEATURE_WORDS))
    .replace('{component}', randomChoice(COMPONENT_WORDS))
    .replace('{bug}', randomChoice(BUG_WORDS))
    .replace('{tech}', randomChoice(TECH_WORDS));
}

export function randomMarkdown(): string {
  const sections: string[] = [];

  // Description (always include to ensure non-empty result)
  sections.push(
    `## Description\n\nThis ${randomChoice(['issue', 'task', 'feature'])} involves ${randomChoice([
      'implementing a new feature',
      'fixing a critical bug',
      'improving performance',
      'refactoring existing code',
      'adding documentation',
    ])} for the ${randomChoice(COMPONENT_WORDS)}.\n\nThe main goal is to ${randomChoice([
      'improve user experience',
      'enhance security',
      'optimize performance',
      'fix critical issues',
      'add new functionality',
    ])}.`
  );

  // Steps to reproduce (for bugs)
  if (randomBoolean(0.3)) {
    const steps = Array.from(
      { length: randomInt(2, 5) },
      (_, i) =>
        `${i + 1}. ${randomChoice([
          'Navigate to the dashboard',
          'Click on the settings button',
          'Fill out the form',
          'Submit the request',
          'Wait for the response',
          'Check the console',
          'Refresh the page',
        ])}`
    ).join('\n');

    sections.push(`## Steps to Reproduce\n\n${steps}`);
  }

  // Expected behavior
  if (randomBoolean(0.4)) {
    sections.push(
      `## Expected Behavior\n\nThe system should ${randomChoice([
        'display the correct data',
        'handle errors gracefully',
        'respond within 200ms',
        'validate input properly',
        'update the UI immediately',
      ])}.`
    );
  }

  // Code block
  if (randomBoolean(0.25)) {
    const codeExamples = [
      '```typescript\nconst authenticate = async (token: string) => {\n  const user = await verifyToken(token);\n  return user;\n};\n```',
      '```sql\nSELECT * FROM users WHERE email = $1 AND deleted_at IS NULL;\n```',
      '```javascript\nfunction validateEmail(email) {\n  const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;\n  return regex.test(email);\n}\n```',
      '```python\ndef process_data(items):\n    return [item.transform() for item in items if item.is_valid()]\n```',
    ];
    sections.push(`## Code Example\n\n${randomChoice(codeExamples)}`);
  }

  // Additional notes
  if (randomBoolean(0.3)) {
    sections.push(
      `## Additional Notes\n\n${randomChoice([
        'This affects all users in the production environment.',
        'Related to issue #123.',
        'Needs to be completed before the next release.',
        'Requires coordination with the backend team.',
        'Consider breaking this into smaller tasks.',
      ])}`
    );
  }

  return sections.join('\n\n');
}

export function randomCommentBody(): string {
  const templates = [
    "I'll start working on this today.",
    'This looks good to me. Approved!',
    "Can we prioritize this? It's blocking our work.",
    'I have a question about the implementation approach.',
    'Great work! Just one minor comment about the code style.',
    'This is related to issue #{issue_number}. We should handle them together.',
    'I think we should also consider {consideration}.',
    'Found a bug while testing: {bug_description}',
    'Updated the PR with the requested changes.',
    'This is now ready for review.',
    'LGTM! 🚀',
    'Can someone take a look at this?',
    "I'm not sure about this approach. What do others think?",
    'Deployed to staging for testing.',
    'Verified that this works as expected. ✅',
  ];

  return randomChoice(templates)
    .replace('{issue_number}', randomInt(100, 999).toString())
    .replace(
      '{consideration}',
      randomChoice(['security', 'performance', 'scalability', 'user experience'])
    )
    .replace(
      '{bug_description}',
      randomChoice(['it crashes on edge cases', 'validation is missing', 'UI is broken on mobile'])
    );
}

// =============================================================================
// User Generators
// =============================================================================

export interface MockUser {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
}

const USER_POOL: MockUser[] = Array.from({ length: 20 }, (_, i) => ({
  id: `user-${i + 1}`,
  displayName: randomName(),
  email: randomEmail(),
  avatarUrl: `https://i.pravatar.cc/150?img=${i + 1}`,
}));

export function randomUser(): MockUser {
  return randomChoice(USER_POOL);
}

export function randomUsers(count: number): MockUser[] {
  const shuffled = shuffle(USER_POOL);
  return shuffled.slice(0, Math.min(count, USER_POOL.length));
}

// =============================================================================
// Label Generators
// =============================================================================

const LABEL_NAMES = [
  'bug',
  'feature',
  'enhancement',
  'documentation',
  'refactoring',
  'performance',
  'security',
  'testing',
  'urgent',
  'high-priority',
  'backend',
  'frontend',
  'database',
  'api',
  'ui',
  'ux',
  'needs-review',
  'in-progress',
  'blocked',
  'help-wanted',
];

const LABEL_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#FFA07A',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E2',
  '#F8B195',
  '#C06C84',
];

export interface MockLabel {
  id: string;
  name: string;
  color: string;
}

export function randomLabel(): MockLabel {
  const name = randomChoice(LABEL_NAMES);
  return {
    id: `label-${LABEL_NAMES.indexOf(name) + 1}`,
    name,
    color: randomChoice(LABEL_COLORS),
  };
}

export function randomLabels(maxCount: number = 5): MockLabel[] {
  const count = randomInt(0, maxCount);
  const shuffled = shuffle(LABEL_NAMES);
  return shuffled.slice(0, count).map((name) => ({
    id: `label-${LABEL_NAMES.indexOf(name) + 1}`,
    name,
    color: randomChoice(LABEL_COLORS),
  }));
}

// =============================================================================
// ID Generators
// =============================================================================

export function generateLinearIssueId(index: number): string {
  return `linear-issue-${String(index + 1).padStart(4, '0')}`;
}

export function generateLinearIdentifier(index: number): string {
  const teams = ['ENG', 'PROD', 'DES', 'OPS'];
  const team = randomChoice(teams);
  return `${team}-${100 + index}`;
}

export function generateZendeskTicketId(index: number): number {
  return 10000 + index;
}

// =============================================================================
// Progress Tracking
// =============================================================================

export function logProgress(current: number, total: number, label: string) {
  const percentage = ((current / total) * 100).toFixed(1);
  const bar = '█'.repeat(Math.floor((current / total) * 20));
  const empty = '░'.repeat(20 - bar.length);
  process.stdout.write(`\r${label}: [${bar}${empty}] ${percentage}% (${current}/${total})`);
  if (current === total) {
    console.log(''); // New line after completion
  }
}
