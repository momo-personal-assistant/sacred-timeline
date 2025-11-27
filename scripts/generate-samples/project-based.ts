/**
 * Project-based Data Generator
 * Generates synthetic data with clear project boundaries
 * Purpose: Create data with objective ground truth (same project = related)
 */

import fs from 'fs';
import path from 'path';

import yaml from 'js-yaml';

import type { CanonicalObject } from '@unified-memory/db';

import { randomChoice, randomInt } from './utils';

// =============================================================================
// Types
// =============================================================================

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  timeline: {
    start: string;
    end: string;
  };
  team: string[];
  priority: string;
  linear_issues?: IssueTemplate[];
  zendesk_tickets?: TicketTemplate[];
  slack_threads?: ThreadTemplate[];
}

interface IssueTemplate {
  title: string;
  description: string;
  labels: string[];
}

interface TicketTemplate {
  title: string;
  description: string;
  priority: string;
}

interface ThreadTemplate {
  title: string;
  description: string;
  channel: string;
}

interface ProjectData {
  metadata: {
    total_projects: number;
    objects_per_project: string;
    total_objects: string;
    expected_gt_relations: string;
  };
  projects: ProjectTemplate[];
}

// =============================================================================
// YAML Loading
// =============================================================================

function loadProjectTemplates(): ProjectData {
  const yamlPath = path.join(__dirname, '../../config/data-generation/project-templates.yaml');
  const yamlContent = fs.readFileSync(yamlPath, 'utf8');
  return yaml.load(yamlContent) as ProjectData;
}

// =============================================================================
// Object Generators
// =============================================================================

function generateLinearIssue(
  projectId: string,
  template: IssueTemplate,
  index: number,
  project: ProjectTemplate
): CanonicalObject {
  const id = `linear-${projectId}-${index + 1}`;
  const identifier = `${projectId.toUpperCase().slice(0, 3)}-${100 + index}`;

  const creator = randomChoice(project.team);
  const assignee = randomChoice(project.team);

  // Random date within project timeline
  const start = new Date(project.timeline.start).getTime();
  const end = new Date(project.timeline.end).getTime();
  const createdAt = new Date(start + Math.random() * (end - start)).toISOString();

  return {
    id,
    platform: 'linear',
    object_type: 'issue',
    title: template.title,
    content: {
      description: template.description,
      state: randomChoice(['todo', 'in_progress', 'done']),
      identifier,
    },
    actors: {
      created_by: creator,
      assignees: [assignee],
      updated_by: assignee,
    },
    properties: {
      priority: project.priority,
      labels: template.labels,
      keywords: template.labels,
      status: randomChoice(['open', 'in_progress', 'completed']),
    },
    timestamps: {
      created_at: createdAt,
      updated_at: createdAt,
    },
    relations: {
      parent_id: null,
      project_id: projectId, // ⭐ Key: links to project
    },
    metadata: {
      project_name: project.name,
      project_description: project.description,
    },
  };
}

function generateZendeskTicket(
  projectId: string,
  template: TicketTemplate,
  index: number,
  project: ProjectTemplate
): CanonicalObject {
  const id = `zendesk-${projectId}-${index + 1}`;
  const ticketNumber = 10000 + index;

  const requester = `customer-${randomInt(1, 100)}@example.com`;
  const assignee = randomChoice(project.team);

  const start = new Date(project.timeline.start).getTime();
  const end = new Date(project.timeline.end).getTime();
  const createdAt = new Date(start + Math.random() * (end - start)).toISOString();

  return {
    id,
    platform: 'zendesk',
    object_type: 'ticket',
    title: template.title,
    content: {
      description: template.description,
      ticket_number: ticketNumber,
      status: randomChoice(['new', 'open', 'pending', 'solved']),
      priority: template.priority,
    },
    actors: {
      created_by: requester,
      assignees: [assignee],
      updated_by: assignee,
    },
    properties: {
      priority: template.priority,
      status: randomChoice(['open', 'pending', 'solved']),
      tags: ['support', 'customer-issue'],
    },
    timestamps: {
      created_at: createdAt,
      updated_at: createdAt,
    },
    relations: {
      parent_id: null,
      project_id: projectId, // ⭐ Key: links to project
    },
    metadata: {
      project_name: project.name,
      project_description: project.description,
    },
  };
}

function generateSlackThread(
  projectId: string,
  template: ThreadTemplate,
  index: number,
  project: ProjectTemplate
): CanonicalObject {
  const id = `slack-${projectId}-${index + 1}`;

  const participants = project.team.slice(0, randomInt(2, project.team.length));
  const creator = participants[0];

  const start = new Date(project.timeline.start).getTime();
  const end = new Date(project.timeline.end).getTime();
  const createdAt = new Date(start + Math.random() * (end - start)).toISOString();

  return {
    id,
    platform: 'slack',
    object_type: 'thread',
    title: template.title,
    content: {
      description: template.description,
      channel: template.channel,
      thread_ts: `${Date.now()}.${randomInt(100000, 999999)}`,
      message_count: randomInt(3, 15),
    },
    actors: {
      created_by: creator,
      participants,
    },
    properties: {
      channel: template.channel,
      is_decision: template.title.toLowerCase().includes('decision'),
      is_discussion: template.title.toLowerCase().includes('discussion'),
    },
    timestamps: {
      created_at: createdAt,
      updated_at: createdAt,
    },
    relations: {
      parent_id: null,
      project_id: projectId, // ⭐ Key: links to project
    },
    metadata: {
      project_name: project.name,
      project_description: project.description,
    },
  };
}

// =============================================================================
// Main Generator
// =============================================================================

export function generateProjectBasedData(): CanonicalObject[] {
  const data = loadProjectTemplates();
  const allObjects: CanonicalObject[] = [];

  console.log('\n🏗️  Generating project-based synthetic data...\n');
  console.log(`📊 Projects: ${data.projects.length}`);
  console.log(`🎯 Target objects: ${data.metadata.total_objects}`);
  console.log(`🔗 Expected GT relations: ${data.metadata.expected_gt_relations}\n`);

  for (const project of data.projects) {
    console.log(`\n📦 Project: ${project.name} (${project.id})`);

    let projectObjects = 0;

    // Generate Linear issues
    if (project.linear_issues) {
      for (let i = 0; i < project.linear_issues.length; i++) {
        const obj = generateLinearIssue(project.id, project.linear_issues[i], i, project);
        allObjects.push(obj);
        projectObjects++;
      }
      console.log(`  ✅ Linear issues: ${project.linear_issues.length}`);
    }

    // Generate Zendesk tickets
    if (project.zendesk_tickets) {
      for (let i = 0; i < project.zendesk_tickets.length; i++) {
        const obj = generateZendeskTicket(project.id, project.zendesk_tickets[i], i, project);
        allObjects.push(obj);
        projectObjects++;
      }
      console.log(`  ✅ Zendesk tickets: ${project.zendesk_tickets.length}`);
    }

    // Generate Slack threads
    if (project.slack_threads) {
      for (let i = 0; i < project.slack_threads.length; i++) {
        const obj = generateSlackThread(project.id, project.slack_threads[i], i, project);
        allObjects.push(obj);
        projectObjects++;
      }
      console.log(`  ✅ Slack threads: ${project.slack_threads.length}`);
    }

    console.log(`  📊 Total objects: ${projectObjects}`);
  }

  console.log(`\n✅ Total objects generated: ${allObjects.length}\n`);

  return allObjects;
}

// =============================================================================
// Save to JSON
// =============================================================================

export function saveToJSON(objects: CanonicalObject[], filename: string) {
  const outputPath = path.join(__dirname, '../../data/samples', filename);
  fs.writeFileSync(outputPath, JSON.stringify(objects, null, 2));
  console.log(`💾 Saved to: ${outputPath}`);
}

// =============================================================================
// CLI Execution
// =============================================================================

if (require.main === module) {
  const objects = generateProjectBasedData();
  saveToJSON(objects, 'project-based.json');

  // Statistics
  const byPlatform = objects.reduce(
    (acc, obj) => {
      acc[obj.platform] = (acc[obj.platform] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('\n📊 Statistics:');
  console.log(`  Linear: ${byPlatform.linear || 0}`);
  console.log(`  Zendesk: ${byPlatform.zendesk || 0}`);
  console.log(`  Slack: ${byPlatform.slack || 0}`);
  console.log(`  Total: ${objects.length}\n`);
}
