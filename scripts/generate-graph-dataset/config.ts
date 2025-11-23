/**
 * Scenario configurations for graph dataset generation
 * Each scenario tests different aspects of the memory graph
 */

import type { ScenarioConfig } from './types';

// =============================================================================
// Company and Industry Data
// =============================================================================

export const COMPANY_NAMES = [
  'Acme Corp',
  'TechStart Inc',
  'GlobalSoft',
  'DataFlow Systems',
  'CloudPeak',
  'InnovateLabs',
  'NextGen Solutions',
  'SmartBiz Co',
  'FutureWorks',
  'DigitalEdge',
  'CoreTech',
  'VentureHub',
  'GrowthScale',
  'AgileFlow',
  'BrightPath',
  'SwiftOps',
];

export const INDUSTRIES = [
  'SaaS',
  'E-commerce',
  'FinTech',
  'HealthTech',
  'EdTech',
  'Marketing',
  'Real Estate',
  'Logistics',
  'Manufacturing',
  'Consulting',
  'Media',
  'Retail',
];

// =============================================================================
// Keyword Groups for Similarity Detection
// =============================================================================

export const KEYWORD_GROUPS = [
  // Performance issues
  ['slow', 'performance', 'timeout', 'latency', 'loading'],

  // Authentication problems
  ['login', 'authentication', 'password', 'token', 'session'],

  // Data issues
  ['data', 'database', 'sync', 'migration', 'export'],

  // UI/UX problems
  ['ui', 'interface', 'design', 'mobile', 'responsive'],

  // Integration issues
  ['api', 'integration', 'webhook', 'third-party', 'connection'],

  // Billing/payment
  ['billing', 'payment', 'subscription', 'invoice', 'pricing'],

  // Security concerns
  ['security', 'vulnerability', 'permissions', 'access', 'encryption'],

  // Feature requests
  ['feature', 'enhancement', 'improvement', 'request', 'new'],
];

// =============================================================================
// Scenario Configurations
// =============================================================================

/**
 * NORMAL: Realistic baseline scenario
 * Simulates typical week at a growing B2B SaaS company
 */
export const SCENARIO_NORMAL: ScenarioConfig = {
  name: 'normal',
  description: 'Realistic baseline scenario - typical week at B2B SaaS company',

  companies: 10,
  users: {
    customer: 25, // ~2-3 per company
    support: 3,
    engineering: 8,
    sales: 4,
    product: 2,
  },

  zendesk: {
    tickets: 50, // ~10 per day for 5 days
    comments_per_ticket: { min: 2, max: 8 },
  },

  slack: {
    thread_rate: 0.6, // 60% of tickets trigger Slack discussion
    messages_per_thread: { min: 3, max: 12 },
    decision_rate: 0.5, // 50% of threads result in decision
  },

  linear: {
    issue_rate: 0.8, // 80% of decisions create Linear issue
    comments_per_issue: { min: 3, max: 10 },
    sub_issue_rate: 0.2, // 20% spawn sub-issues
  },

  patterns: {
    recurring_issue_rate: 0.15,
    similar_keywords: KEYWORD_GROUPS,
  },
};

/**
 * SALES_HEAVY: High-touch enterprise customer scenario
 * Many escalations, lots of Sales involvement
 */
export const SCENARIO_SALES_HEAVY: ScenarioConfig = {
  name: 'sales_heavy',
  description: 'High-touch enterprise scenario with many escalations',

  companies: 5, // Fewer companies, but enterprise
  users: {
    customer: 30, // Multiple stakeholders per company
    support: 3,
    engineering: 8,
    sales: 8, // More sales involvement!
    product: 3,
  },

  zendesk: {
    tickets: 40,
    comments_per_ticket: { min: 5, max: 15 }, // Longer threads
  },

  slack: {
    thread_rate: 0.9, // Almost everything discussed in Slack
    messages_per_thread: { min: 8, max: 25 }, // Long discussions
    decision_rate: 0.7, // High decision rate
  },

  linear: {
    issue_rate: 0.9, // Almost all decisions → Linear
    comments_per_issue: { min: 5, max: 15 },
    sub_issue_rate: 0.3, // Complex issues broken down
  },

  patterns: {
    recurring_issue_rate: 0.1,
    similar_keywords: KEYWORD_GROUPS,
  },
};

/**
 * DEV_HEAVY: High volume of technical bugs
 * Less Slack discussion, more direct bug → Linear flow
 */
export const SCENARIO_DEV_HEAVY: ScenarioConfig = {
  name: 'dev_heavy',
  description: 'High volume technical scenario with direct bug tracking',

  companies: 15, // More diverse customer base
  users: {
    customer: 30,
    support: 5, // More support needed
    engineering: 12, // Large dev team
    sales: 3,
    product: 3,
  },

  zendesk: {
    tickets: 80, // High volume
    comments_per_ticket: { min: 1, max: 5 }, // Shorter, more technical
  },

  slack: {
    thread_rate: 0.4, // Less discussion (bugs are clear)
    messages_per_thread: { min: 2, max: 8 },
    decision_rate: 0.8, // Quick decisions
  },

  linear: {
    issue_rate: 0.95, // Almost everything becomes issue
    comments_per_issue: { min: 2, max: 8 },
    sub_issue_rate: 0.15,
  },

  patterns: {
    recurring_issue_rate: 0.25, // More duplicate bugs!
    similar_keywords: KEYWORD_GROUPS,
  },
};

/**
 * PATTERN: Designed to test pattern detection
 * High rate of recurring/similar issues across companies
 */
export const SCENARIO_PATTERN: ScenarioConfig = {
  name: 'pattern',
  description: 'Pattern detection test - many recurring/similar issues',

  companies: 8,
  users: {
    customer: 20,
    support: 3,
    engineering: 8,
    sales: 4,
    product: 2,
  },

  zendesk: {
    tickets: 60,
    comments_per_ticket: { min: 3, max: 8 },
  },

  slack: {
    thread_rate: 0.7,
    messages_per_thread: { min: 4, max: 12 },
    decision_rate: 0.6,
  },

  linear: {
    issue_rate: 0.85,
    comments_per_issue: { min: 3, max: 10 },
    sub_issue_rate: 0.2,
  },

  patterns: {
    recurring_issue_rate: 0.4, // 40% are recurring!
    similar_keywords: KEYWORD_GROUPS,
    spike_days: [2, 4], // Traffic spikes on day 2 and 4
  },
};

/**
 * STRESS: Large volume for performance testing
 * Tests graph construction and query performance
 */
export const SCENARIO_STRESS: ScenarioConfig = {
  name: 'stress',
  description: 'Large volume scenario for performance testing',

  companies: 30,
  users: {
    customer: 100,
    support: 10,
    engineering: 20,
    sales: 12,
    product: 5,
  },

  zendesk: {
    tickets: 200,
    comments_per_ticket: { min: 2, max: 10 },
  },

  slack: {
    thread_rate: 0.6,
    messages_per_thread: { min: 3, max: 15 },
    decision_rate: 0.5,
  },

  linear: {
    issue_rate: 0.8,
    comments_per_issue: { min: 3, max: 12 },
    sub_issue_rate: 0.2,
  },

  patterns: {
    recurring_issue_rate: 0.2,
    similar_keywords: KEYWORD_GROUPS,
  },
};

// =============================================================================
// Export all scenarios
// =============================================================================

export const SCENARIOS: Record<string, ScenarioConfig> = {
  normal: SCENARIO_NORMAL,
  sales_heavy: SCENARIO_SALES_HEAVY,
  dev_heavy: SCENARIO_DEV_HEAVY,
  pattern: SCENARIO_PATTERN,
  stress: SCENARIO_STRESS,
};

// Default scenario for testing
export const DEFAULT_SCENARIO = 'normal';
