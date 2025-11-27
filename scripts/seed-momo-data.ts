/**
 * Seed script for Momo internal usecase data
 * Inserts VOC (Discord) and Linear issues into canonical_objects table
 *
 * Usage: npx tsx scripts/seed-momo-data.ts
 */

import { UnifiedMemoryDB } from '@unified-memory/db';
import type { CreateCanonicalObjectInput } from '@unified-memory/db';

// VOC data from Discord
const MOMO_VOC_DATA = [
  {
    id: 'voc-001',
    title: 'Gmail 이메일 중복 표시 문제',
    body: '회사 메일 스레드 중에, 지메일로 이메일을 보내면, 보내면서 동시에 메일 받는사람에 나도 들어가있어서, 내가 보낸 메일이 2번 보여요',
    actor: 'alberttri23@gmail.com',
    timestamp: '2024-11-14',
    status: 'resolved',
    linkedIssue: 'TEN-159',
  },
  {
    id: 'voc-002',
    title: '카드 추가 요청',
    body: '결제 수단에 카드 추가 가능할까요?',
    actor: 'alberttri23@gmail.com',
    timestamp: '2024-11-14',
    status: 'pending',
  },
  {
    id: 'voc-003',
    title: '메일 작성 CC/BCC 기능 요청',
    body: '메일 작성할때 cc/bcc 넣는거 추가 가능할까요?',
    actor: 'alberttri23@gmail.com',
    timestamp: '2024-11-14',
    status: 'resolved',
    linkedIssue: 'TEN-160',
  },
  {
    id: 'voc-004',
    title: '투두-이메일 연결 요청',
    body: '투두 추가하면 관련 이메일도 보이면 좋겠음',
    actor: 'alberttri23@gmail.com',
    timestamp: '2024-11-14',
    status: 'resolved',
    linkedIssue: 'TEN-144',
  },
  {
    id: 'voc-005',
    title: '슬랙 연결 가능 여부',
    body: '슬랙도 연결 가능할까요?',
    actor: 'alberttri23@gmail.com',
    timestamp: '2024-11-14',
    status: 'backlog',
  },
  {
    id: 'voc-006',
    title: 'www 도메인 로그인 유실',
    body: '웹에서 www.ten.im 으로 접속하면 로그인 정보가 유실되는 문제 (ten.im 에서만 유지)',
    actor: 'alberttri23@gmail.com',
    timestamp: '2024-11-14',
    status: 'resolved',
    linkedIssue: 'TEN-125',
  },
];

// Linear issues (49 total)
const MOMO_LINEAR_DATA = [
  // Done issues (30)
  {
    id: 'TEN-190',
    title: 'dark mode bug broooo',
    body: '',
    actor: 'Cailyn Yong',
    timestamp: '2025-10-22',
    status: 'Done',
  },
  {
    id: 'TEN-189',
    title: 'smoother onboarding',
    body: 'for slack, need to automatically show the channels that the user is mentioned in',
    actor: 'Cailyn Yong',
    timestamp: '2025-10-22',
    status: 'Done',
  },
  {
    id: 'TEN-188',
    title: "AI filtering todo/followup based on user's rules input",
    body: '',
    actor: 'Cailyn Yong',
    timestamp: '2025-10-22',
    status: 'Done',
  },
  {
    id: 'TEN-179',
    title: 'Unified chat input sidebar with momo toggle',
    body: 'Build unified chat interface for all different platforms',
    actor: 'Cailyn Yong',
    timestamp: '2025-09-27',
    status: 'Done',
  },
  {
    id: 'TEN-174',
    title: 'Implement Gmail polling for real-time email updates',
    body: 'Set up Gmail polling mechanism to check for new emails',
    actor: 'Jongmin Park',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-173',
    title: 'Set up Server-Sent Events for real-time updates',
    body: 'Implement SSE infrastructure for pushing real-time updates',
    actor: 'Jongmin Park',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-171',
    title: 'Create Daily Brief dashboard with action items',
    body: 'Build the Daily Brief view showing categorized action items',
    actor: 'Cailyn Yong',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-170',
    title: 'Build unified inbox view with platform tabs',
    body: 'Create the main unified inbox interface combining Gmail and Slack',
    actor: 'Cailyn Yong',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-169',
    title: 'Implement user feedback loop for category corrections',
    body: 'Build system for users to correct categorizations',
    actor: 'Cailyn Yong',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-168',
    title: 'Create action item extraction and transformation service',
    body: 'Build service to extract and transform messages into actionable items',
    actor: 'Cailyn Yong',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-166',
    title: 'Implement Slack message sending and thread replies',
    body: 'Implement Slack API functionality for sending messages and replies',
    actor: 'Jongmin Park',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-165',
    title: 'Create Slack UI with channel view and thread support',
    body: 'Build Slack-like UI for viewing channels, DMs, and threads',
    actor: 'Cailyn Yong',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-164',
    title: 'Build Slack message fetching and conversation history sync',
    body: 'Implement Slack message fetching for channels, DMs, and threads',
    actor: 'Jongmin Park',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-163',
    title: 'Implement Slack Events API webhook for real-time messages',
    body: 'Set up Slack Events API webhook to receive real-time messages',
    actor: 'Jongmin Park',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-162',
    title: 'Set up Slack OAuth with bot and user scopes',
    body: 'Implement Slack OAuth flow with both bot and user token scopes',
    actor: 'Jongmin Park',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-161',
    title: 'Implement Gmail send and reply API functionality',
    body: 'Implement Gmail API functionality for sending emails and replies',
    actor: 'Jongmin Park',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-160',
    title: 'Create Gmail UI with thread view and message composition',
    body: 'Build Gmail-like UI with cc/bcc functionality',
    actor: 'Cailyn Yong',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-159',
    title: 'Build Gmail message fetching and incremental sync',
    body: 'Implement Gmail message fetching with incremental sync using History API',
    actor: 'Jongmin Park',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-158',
    title: 'Implement Gmail OAuth connection flow and scope management',
    body: 'Set up Gmail OAuth connection with proper scope management',
    actor: 'Jongmin Park',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-156',
    title: 'Implement IndexedDB storage layer for message caching',
    body: 'Create IndexedDB storage layer for client-side message storage',
    actor: 'Jongmin Park',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-154',
    title: 'Create user onboarding flow with company information capture',
    body: 'Build the onboarding flow that captures user and company information',
    actor: 'Cailyn Yong',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-153',
    title: 'Implement Google OAuth authentication with Next-Auth',
    body: 'Set up Google OAuth authentication for user login/signup',
    actor: 'Jongmin Park',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-152',
    title: 'Set up Next.js project with TypeScript and core dependencies',
    body: 'Initialize the Next.js 14 project with all necessary dependencies',
    actor: 'Cailyn Yong',
    timestamp: '2025-09-22',
    status: 'Done',
  },
  {
    id: 'TEN-151',
    title: 'Investigate Message Storage System Design and State Management',
    body: 'Design an efficient database structure for storing messages',
    actor: 'Jongmin Park',
    timestamp: '2025-09-20',
    status: 'Done',
  },
  {
    id: 'TEN-140',
    title: 'create a unified data schema for loading the messages (gmail, slack)',
    body: '',
    actor: 'Cailyn Yong',
    timestamp: '2025-09-18',
    status: 'Done',
  },
  {
    id: 'TEN-139',
    title: 'load gmail messages through scopes',
    body: '',
    actor: 'Cailyn Yong',
    timestamp: '2025-09-18',
    status: 'Done',
  },
  {
    id: 'TEN-138',
    title: 'bring slack threads that include me into web',
    body: '',
    actor: 'Cailyn Yong',
    timestamp: '2025-09-18',
    status: 'Done',
  },
  {
    id: 'TEN-137',
    title: 'bring mentions from slack onto web',
    body: '',
    actor: 'Cailyn Yong',
    timestamp: '2025-09-18',
    status: 'Done',
  },
  {
    id: 'TEN-136',
    title: 'check on bringing private dms onto the group',
    body: '',
    actor: 'Cailyn Yong',
    timestamp: '2025-09-18',
    status: 'Done',
  },
  {
    id: 'TEN-135',
    title: 'slack channels, 메시지 전부 불러오기',
    body: '',
    actor: 'Cailyn Yong',
    timestamp: '2025-09-18',
    status: 'Done',
  },
  // Canceled issues (19)
  {
    id: 'TEN-178',
    title: 'Implement cron job system for scheduled tasks',
    body: 'Set up a cron job system for scheduled tasks like daily briefs',
    actor: '',
    timestamp: '2025-09-22',
    status: 'Canceled',
  },
  {
    id: 'TEN-177',
    title: 'Create reminder settings and preferences UI',
    body: 'Build UI for users to configure reminder preferences',
    actor: '',
    timestamp: '2025-09-22',
    status: 'Canceled',
  },
  {
    id: 'TEN-176',
    title: 'Build Slack reminder bot for daily briefs',
    body: 'Create a Slack bot that sends daily brief reminders',
    actor: 'Jongmin Park',
    timestamp: '2025-09-22',
    status: 'Canceled',
  },
  {
    id: 'TEN-175',
    title: 'Create real-time sync coordinator service',
    body: 'Build a coordinator service that manages real-time updates',
    actor: 'Jongmin Park',
    timestamp: '2025-09-22',
    status: 'Canceled',
  },
  {
    id: 'TEN-172',
    title: 'Implement responsive design and mobile optimization',
    body: 'Ensure the application is fully responsive',
    actor: 'Cailyn Yong',
    timestamp: '2025-09-22',
    status: 'Canceled',
  },
  {
    id: 'TEN-167',
    title: 'Implement rule-based message categorization engine',
    body: 'Build a rule-based engine to categorize messages',
    actor: 'Jongmin Park',
    timestamp: '2025-09-22',
    status: 'Canceled',
  },
  {
    id: 'TEN-157',
    title: 'Create unified message data model and TypeScript interfaces',
    body: 'Define unified data models and TypeScript interfaces',
    actor: 'Jongmin Park',
    timestamp: '2025-09-22',
    status: 'Canceled',
  },
  {
    id: 'TEN-155',
    title: 'Set up Supabase project and database schema',
    body: 'Initialize Supabase project and create the core database schema',
    actor: 'Jongmin Park',
    timestamp: '2025-09-22',
    status: 'Canceled',
  },
  {
    id: 'TEN-150',
    title: 'Socket.IO and SSE communication testing',
    body: 'Jest, Socket.IO Client testing, SSE testing',
    actor: 'Jongmin Park',
    timestamp: '2025-09-19',
    status: 'Canceled',
  },
  {
    id: 'TEN-149',
    title: 'Virtual AI response streaming via SSE',
    body: 'SSE streaming, virtual response generation',
    actor: 'Jongmin Park',
    timestamp: '2025-09-19',
    status: 'Canceled',
  },
  {
    id: 'TEN-148',
    title: 'Multi-platform message unified storage',
    body: 'PostgreSQL transactions, Socket.IO broadcast',
    actor: 'Jongmin Park',
    timestamp: '2025-09-19',
    status: 'Canceled',
  },
  {
    id: 'TEN-147',
    title: 'Email reception detection via Gmail API',
    body: 'Gmail API, Google Cloud Pub/Sub, polling mechanism',
    actor: 'Cailyn Yong',
    timestamp: '2025-09-19',
    status: 'Canceled',
  },
  {
    id: 'TEN-146',
    title: 'Real-time message reception via Slack Events API',
    body: 'Slack Events API, Webhook endpoints',
    actor: 'Jongmin Park',
    timestamp: '2025-09-19',
    status: 'Canceled',
  },
  {
    id: 'TEN-145',
    title: 'Server-to-Slack message transmission',
    body: 'Slack Web API, existing OAuth token utilization',
    actor: 'Cailyn Yong',
    timestamp: '2025-09-19',
    status: 'Canceled',
  },
  {
    id: 'TEN-144',
    title: 'Real-time message send/receive via Socket.IO',
    body: 'Socket.IO events, message validation',
    actor: 'Jongmin Park',
    timestamp: '2025-09-19',
    status: 'Canceled',
  },
  {
    id: 'TEN-143',
    title: 'Efficient client-server data synchronization',
    body: 'PostgreSQL timestamp queries, REST API',
    actor: 'Jongmin Park',
    timestamp: '2025-09-19',
    status: 'Canceled',
  },
  {
    id: 'TEN-142',
    title: 'DB schema extension for real-time chat',
    body: 'PostgreSQL, Supabase, migration scripts',
    actor: 'Jongmin Park',
    timestamp: '2025-09-19',
    status: 'Canceled',
  },
  {
    id: 'TEN-141',
    title: 'SSE streaming endpoint implementation',
    body: 'Express.js SSE, EventSource compatibility',
    actor: 'Jongmin Park',
    timestamp: '2025-09-19',
    status: 'Canceled',
  },
  {
    id: 'TEN-134',
    title: 'Socket.IO Server Setup and Basic Infrastructure',
    body: 'Socket.IO, Express.js, TypeScript, CORS configuration',
    actor: 'Jongmin Park',
    timestamp: '2025-09-17',
    status: 'Canceled',
  },
];

// VOC -> Issue relations
const MOMO_RELATIONS = [
  { vocId: 'voc-001', issueId: 'TEN-159', confidence: 0.95 },
  { vocId: 'voc-003', issueId: 'TEN-160', confidence: 0.98 },
  { vocId: 'voc-004', issueId: 'TEN-144', confidence: 0.75 },
  { vocId: 'voc-006', issueId: 'TEN-125', confidence: 0.92 },
];

function convertVOCToCanonical(voc: (typeof MOMO_VOC_DATA)[0]): CreateCanonicalObjectInput {
  const now = new Date().toISOString();
  const createdAt = `${voc.timestamp}T00:00:00Z`;

  // Find related issue
  const relation = MOMO_RELATIONS.find((r) => r.vocId === voc.id);

  return {
    id: `discord|tenxai|voc|${voc.id}`,
    platform: 'discord',
    object_type: 'voc',
    title: voc.title,
    body: voc.body,
    actors: {
      created_by: `user:${voc.actor}`,
    },
    timestamps: {
      created_at: createdAt,
      updated_at: now,
    },
    relations: relation
      ? {
          resulted_in_issue: `linear|tenxai|issue|${relation.issueId}`,
        }
      : undefined,
    properties: {
      status: voc.status,
      linkedIssue: voc.linkedIssue,
    },
    visibility: 'team',
  };
}

function convertLinearToCanonical(issue: (typeof MOMO_LINEAR_DATA)[0]): CreateCanonicalObjectInput {
  const now = new Date().toISOString();
  const createdAt = `${issue.timestamp}T00:00:00Z`;

  // Find related VOC
  const relation = MOMO_RELATIONS.find((r) => r.issueId === issue.id);

  return {
    id: `linear|tenxai|issue|${issue.id}`,
    platform: 'linear',
    object_type: 'issue',
    title: issue.title,
    body: issue.body || undefined,
    actors: {
      created_by: issue.actor ? `user:${issue.actor}` : undefined,
      assignees: issue.actor ? [`user:${issue.actor}`] : [],
    },
    timestamps: {
      created_at: createdAt,
      updated_at: now,
      closed_at: issue.status === 'Done' || issue.status === 'Canceled' ? now : undefined,
    },
    relations: relation
      ? {
          triggered_by_ticket: `discord|tenxai|voc|${relation.vocId}`,
        }
      : undefined,
    properties: {
      status: issue.status,
      url: `https://linear.app/tenxai/issue/${issue.id}`,
    },
    visibility: 'team',
  };
}

async function seedMomoData() {
  console.log('Starting Momo data seed...\n');

  const db = new UnifiedMemoryDB({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    vectorDimensions: parseInt(process.env.VECTOR_DIMENSIONS || '1536', 10),
  });

  try {
    await db.initialize();

    // Insert VOC data
    console.log('Inserting VOC data (6 items)...');
    for (const voc of MOMO_VOC_DATA) {
      const canonical = convertVOCToCanonical(voc);
      try {
        await db.createCanonicalObject(canonical);
        console.log(`  ✅ ${voc.id}: ${voc.title.slice(0, 40)}...`);
      } catch (err) {
        if ((err as Error).message?.includes('duplicate key')) {
          console.log(`  ⏭️  ${voc.id}: Already exists, skipping`);
        } else {
          throw err;
        }
      }
    }

    // Insert Linear issues
    console.log('\nInserting Linear issues (49 items)...');
    for (const issue of MOMO_LINEAR_DATA) {
      const canonical = convertLinearToCanonical(issue);
      try {
        await db.createCanonicalObject(canonical);
        console.log(`  ✅ ${issue.id}: ${issue.title.slice(0, 40)}...`);
      } catch (err) {
        if ((err as Error).message?.includes('duplicate key')) {
          console.log(`  ⏭️  ${issue.id}: Already exists, skipping`);
        } else {
          throw err;
        }
      }
    }

    console.log('\n✅ Seed completed successfully!');
    console.log(`   - VOC items: ${MOMO_VOC_DATA.length}`);
    console.log(`   - Linear issues: ${MOMO_LINEAR_DATA.length}`);
    console.log(`   - Relations: ${MOMO_RELATIONS.length}`);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

seedMomoData();
