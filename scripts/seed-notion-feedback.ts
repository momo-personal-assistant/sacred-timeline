/**
 * Seed Notion Feedback Data
 *
 * Creates sample Notion meeting notes and feedback pages that reference Linear issues
 * for testing Phase B (Issue → Feedback matching)
 */

import { UnifiedMemoryDB } from '@unified-memory/db';
import type { CreateCanonicalObjectInput } from '@unified-memory/db';

import { NotionTransformer } from '../packages/transformers/src/notion-transformer';
import type { NotionPage } from '../packages/transformers/src/notion-transformer';

// Sample Notion feedback pages referencing completed Linear issues
const notionFeedbackData: NotionPage[] = [
  {
    id: 'notion-001',
    created_time: '2025-10-15T14:00:00.000Z',
    last_edited_time: '2025-10-15T14:30:00.000Z',
    properties: {
      title: [
        {
          type: 'text',
          plain_text: 'User Feedback Session - Gmail CC/BCC Feature',
          text: { content: 'User Feedback Session - Gmail CC/BCC Feature' },
        },
      ],
    },
    content: `# User Feedback Session - Gmail CC/BCC Feature

**Date**: 2025-10-15
**Participants**: Cailyn (Product), User A (alberttri23@gmail.com)

## Summary
We received great feedback on the new CC/BCC functionality (TEN-160) that was recently shipped. The user mentioned that the feature works well but there are some UI improvements that could enhance the experience.

## Key Feedback Points
- ✅ CC/BCC buttons are easy to find
- ✅ Recipients are added correctly to Gmail
- ⚠️ UI could be more intuitive - consider inline editing
- ⚠️ Would like to see CC/BCC recipients in the preview before sending

## Related Issues
- TEN-160: Add CC/BCC support for Gmail

## Action Items
- [ ] Consider UI improvements for inline CC/BCC editing
- [ ] Add preview for CC/BCC recipients`,
    created_by: {
      id: 'user-cailyn',
      email: 'cailyn@tenxai.com',
    },
    object_type: 'feedback',
    participants: ['cailyn@tenxai.com', 'alberttri23@gmail.com'],
    keywords: ['cc', 'bcc', 'gmail', 'ui', 'TEN-160'],
    linked_issues: ['TEN-160'],
    note_type: 'user_feedback',
  },
  {
    id: 'notion-002',
    created_time: '2025-10-20T16:00:00.000Z',
    last_edited_time: '2025-10-20T16:45:00.000Z',
    properties: {
      title: [
        {
          type: 'text',
          plain_text: 'Product Meeting - Slack Integration Status',
          text: { content: 'Product Meeting - Slack Integration Status' },
        },
      ],
    },
    content: `# Product Meeting - Slack Integration Status

**Date**: 2025-10-20
**Participants**: Product Team

## Slack OAuth & Message Sync
We successfully shipped the Slack OAuth (TEN-162) and message fetching (TEN-164) features. Early users report that messages are syncing correctly and the integration is stable.

## Feedback from Beta Users
- The Slack integration is working great
- Messages appear in the unified inbox as expected
- One user mentioned they'd like better filtering options for Slack channels

## Related Features
- TEN-162: Slack OAuth
- TEN-164: Fetch Slack messages
- TEN-165: Background Slack sync

## Next Steps
- Monitor usage metrics
- Consider adding channel filtering`,
    created_by: {
      id: 'user-cailyn',
      email: 'cailyn@tenxai.com',
    },
    object_type: 'meeting_note',
    participants: ['cailyn@tenxai.com'],
    keywords: ['slack', 'oauth', 'integration', 'TEN-162', 'TEN-164', 'TEN-165'],
    linked_issues: ['TEN-162', 'TEN-164', 'TEN-165'],
    note_type: 'product_meeting',
  },
  {
    id: 'notion-003',
    created_time: '2025-11-01T10:00:00.000Z',
    last_edited_time: '2025-11-01T10:30:00.000Z',
    properties: {
      title: [
        {
          type: 'text',
          plain_text: 'User Interview - Gmail Sync Issues Resolved',
          text: { content: 'User Interview - Gmail Sync Issues Resolved' },
        },
      ],
    },
    content: `# User Interview - Gmail Sync Issues Resolved

**Date**: 2025-11-01
**Interviewee**: alberttri23@gmail.com

## Background
The user previously reported seeing duplicate Gmail messages (1 message in Gmail client but 3 in Momo dashboard). This was tracked in TEN-159.

## Feedback
The issue has been completely resolved! The user reports that:
- Messages now sync 1:1 with Gmail
- No more duplicate messages appearing
- Performance is great

## Satisfaction
⭐⭐⭐⭐⭐ (5/5) - Very satisfied with the fix

## Related Issues
- TEN-159: Fix Gmail message duplication bug
- TEN-156: Improve Gmail sync reliability`,
    created_by: {
      id: 'user-cailyn',
      email: 'cailyn@tenxai.com',
    },
    object_type: 'feedback',
    participants: ['cailyn@tenxai.com', 'alberttri23@gmail.com'],
    keywords: ['gmail', 'sync', 'bug', 'TEN-159', 'TEN-156'],
    linked_issues: ['TEN-159', 'TEN-156'],
    note_type: 'user_interview',
  },
  {
    id: 'notion-004',
    created_time: '2025-10-25T15:00:00.000Z',
    last_edited_time: '2025-10-25T15:20:00.000Z',
    properties: {
      title: [
        {
          type: 'text',
          plain_text: 'Feature Validation - Email Reply from Todo',
          text: { content: 'Feature Validation - Email Reply from Todo' },
        },
      ],
    },
    content: `# Feature Validation - Email Reply from Todo

**Date**: 2025-10-25

## Feature Overview
We shipped the ability to reply to emails directly from the Todo view (TEN-171, TEN-168). This was a highly requested feature.

## User Testing Results
Tested with 3 users:
- All users found the reply button intuitive
- Response time is fast
- Email composition works smoothly

## User Quotes
> "This is exactly what I needed! I can now handle all my emails from one place." - User B

## Status
✅ Feature validated and working well

## Related Issues
- TEN-171: Add email reply from Todo
- TEN-168: Email composition UI`,
    created_by: {
      id: 'user-cailyn',
      email: 'cailyn@tenxai.com',
    },
    object_type: 'feedback',
    participants: ['cailyn@tenxai.com'],
    keywords: ['email', 'todo', 'reply', 'TEN-171', 'TEN-168'],
    linked_issues: ['TEN-171', 'TEN-168'],
    note_type: 'feature_validation',
  },
];

async function seedNotionFeedback() {
  console.log('🌱 Starting Notion feedback seed...\n');

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
    console.log('✅ Database connected\n');

    const transformer = new NotionTransformer({
      workspace: 'tenxai',
      includeMetadata: true,
      preserveRawData: false,
    });

    let insertedCount = 0;
    let updatedCount = 0;

    for (const page of notionFeedbackData) {
      // Validate page
      const validation = transformer.validatePage(page);
      if (!validation.valid) {
        console.error(`❌ Invalid page ${page.id}: ${validation.errors.join(', ')}`);
        continue;
      }

      // Transform to CanonicalObject
      const canonicalObj: CreateCanonicalObjectInput = transformer.transform(page);

      // Check if exists
      const pool = (
        db as unknown as {
          pool: { query: (sql: string, params: unknown[]) => Promise<{ rowCount: number }> };
        }
      ).pool;

      const checkResult = await pool.query('SELECT id FROM canonical_objects WHERE id = $1', [
        canonicalObj.id,
      ]);

      if (checkResult.rowCount === 0) {
        // Insert new
        await db.createCanonicalObject(canonicalObj);
        console.log(`✅ Inserted: ${canonicalObj.title} (${canonicalObj.id})`);
        insertedCount++;
      } else {
        // Update existing
        await pool.query(
          `
          UPDATE canonical_objects
          SET
            title = $2,
            body = $3,
            actors = $4,
            timestamps = $5,
            properties = $6,
            relations = $7,
            indexed_at = NOW()
          WHERE id = $1
        `,
          [
            canonicalObj.id,
            canonicalObj.title,
            canonicalObj.body,
            JSON.stringify(canonicalObj.actors),
            JSON.stringify(canonicalObj.timestamps),
            JSON.stringify(canonicalObj.properties),
            JSON.stringify(canonicalObj.relations || {}),
          ]
        );
        console.log(`✅ Updated: ${canonicalObj.title} (${canonicalObj.id})`);
        updatedCount++;
      }
    }

    await db.close();

    console.log('\n📊 Seed Summary:');
    console.log(`   Total: ${notionFeedbackData.length}`);
    console.log(`   Inserted: ${insertedCount}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log('\n✅ Notion feedback seed completed!');
  } catch (error) {
    console.error('❌ Error seeding Notion feedback:', error);
    try {
      await db.close();
    } catch {
      // Ignore close error
    }
    process.exit(1);
  }
}

// Run seed
seedNotionFeedback();
