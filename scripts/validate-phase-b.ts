/**
 * Validate Phase B: Issue → Feedback Matching
 *
 * Tests:
 * 1. Feedback data exists in DB
 * 2. Issue-Feedback matching algorithm
 * 3. Relations with validated_by
 */

import { UnifiedMemoryDB } from '@unified-memory/db';

interface MatchResult {
  issueId: string;
  issueTitle: string;
  feedbackId: string;
  feedbackTitle: string;
  matchScore: number;
  matchReasons: string[];
}

async function validatePhaseB() {
  console.log('🔍 Starting Phase B Validation\n');

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

    const pool = (
      db as unknown as { pool: { query: (sql: string) => Promise<{ rows: unknown[] }> } }
    ).pool;

    // Test 1: Check Notion feedback exists
    console.log('📊 Test 1: Notion Feedback Data');
    const feedbackResult = await pool.query(`
      SELECT
        id,
        object_type,
        title,
        properties->'keywords' as keywords,
        relations->'validated_by' as validated_by
      FROM canonical_objects
      WHERE platform = 'notion'
      ORDER BY timestamps->>'created_at' DESC
    `);

    console.log(`   Found ${feedbackResult.rows.length} Notion feedback items`);
    feedbackResult.rows.forEach((row: any, i) => {
      const shortId = row.id.split('|').pop();
      const keywords = Array.isArray(row.keywords)
        ? row.keywords
        : JSON.parse(row.keywords || '[]');
      console.log(
        `   ${i + 1}. ${shortId}: ${row.object_type} - "${row.title.substring(0, 50)}..."`
      );
      console.log(`      Keywords: ${keywords.join(', ')}`);
    });
    console.log('');

    // Test 2: Check Linear Issues (Done)
    console.log('📊 Test 2: Linear Done Issues');
    const issuesResult = await pool.query(`
      SELECT
        id,
        title,
        properties->'status' as status,
        timestamps->>'updated_at' as updated_at
      FROM canonical_objects
      WHERE platform = 'linear'
        AND object_type = 'issue'
        AND properties->>'status' = 'Done'
      ORDER BY timestamps->>'updated_at' DESC
      LIMIT 10
    `);

    console.log(`   Found ${issuesResult.rows.length} Done issues (showing 10)`);
    issuesResult.rows.forEach((row: any, i) => {
      const shortId = row.id.split('|').pop();
      console.log(`   ${i + 1}. ${shortId}: ${row.title.substring(0, 60)}...`);
    });
    console.log('');

    // Test 3: Manual matching algorithm
    console.log('📊 Test 3: Issue-Feedback Matching');
    const matches: MatchResult[] = [];

    for (const issueRow of issuesResult.rows.slice(0, 30)) {
      const issue = issueRow as any;
      const issueShortId = issue.id.split('|').pop();
      const issueKeywords = extractKeywords(issue.title, '');
      const _issueCompletedAt = issue.updated_at;

      for (const feedbackRow of feedbackResult.rows) {
        const feedback = feedbackRow as any;
        const feedbackShortId = feedback.id.split('|').pop();
        const feedbackKeywords = Array.isArray(feedback.keywords)
          ? feedback.keywords
          : JSON.parse(feedback.keywords || '[]');

        // Calculate match score
        const keywordScore = calculateKeywordScore(issueKeywords, feedbackKeywords, issueShortId);
        const totalScore = keywordScore;

        const matchReasons: string[] = [];
        if (keywordScore > 0.3) {
          const overlap = issueKeywords.filter((k) => feedbackKeywords.includes(k));
          if (overlap.length > 0) {
            matchReasons.push(`Keywords: ${overlap.join(', ')}`);
          }
        }
        if (feedbackKeywords.includes(issueShortId)) {
          matchReasons.push(`Direct reference: ${issueShortId}`);
        }

        if (totalScore >= 0.3 || feedbackKeywords.includes(issueShortId)) {
          matches.push({
            issueId: issueShortId,
            issueTitle: issue.title,
            feedbackId: feedbackShortId,
            feedbackTitle: feedback.title,
            matchScore: totalScore,
            matchReasons,
          });
        }
      }
    }

    // Sort by score
    matches.sort((a, b) => b.matchScore - a.matchScore);

    console.log(`   Found ${matches.length} matches:`);
    matches.forEach((match, i) => {
      console.log(
        `   ${i + 1}. ${match.issueId} ↔ ${match.feedbackId} (Score: ${(match.matchScore * 100).toFixed(0)}%)`
      );
      console.log(`      Issue: ${match.issueTitle.substring(0, 50)}...`);
      console.log(`      Feedback: ${match.feedbackTitle.substring(0, 50)}...`);
      console.log(`      Reasons: ${match.matchReasons.join(', ')}`);
    });
    console.log('');

    // Test 4: Check Relations
    console.log('📊 Test 4: Relations (VOC → Issue, Issue → Feedback)');
    const relationsResult = await pool.query(`
      SELECT
        id,
        platform,
        object_type,
        relations
      FROM canonical_objects
      WHERE relations IS NOT NULL
        AND jsonb_typeof(relations) = 'object'
        AND relations != '{}'::jsonb
    `);

    console.log(`   Found ${relationsResult.rows.length} objects with relations`);
    relationsResult.rows.forEach((row: any) => {
      const shortId = row.id.split('|').pop();
      const relations = row.relations || {};
      const relTypes = Object.keys(relations);
      console.log(`   - ${shortId} (${row.platform}/${row.object_type}): ${relTypes.join(', ')}`);
    });
    console.log('');

    await db.close();

    // Summary
    console.log('📈 Phase B Validation Summary:');
    console.log(`   ✅ Notion Feedback: ${feedbackResult.rows.length} items`);
    console.log(`   ✅ Done Issues: ${issuesResult.rows.length} items`);
    console.log(`   ✅ Matches Found: ${matches.length}`);
    console.log(
      `   ✅ High Confidence (>70%): ${matches.filter((m) => m.matchScore >= 0.7).length}`
    );
    console.log(
      `   ✅ Medium Confidence (50-70%): ${matches.filter((m) => m.matchScore >= 0.5 && m.matchScore < 0.7).length}`
    );
    console.log(`   ✅ Relations: ${relationsResult.rows.length} objects`);

    if (matches.length >= 4) {
      console.log('\n✅ Phase B validation PASSED! Matching algorithm is working correctly.');
    } else {
      console.log(
        '\n⚠️  Phase B validation completed but fewer matches than expected (should be >= 4)'
      );
    }
  } catch (error) {
    console.error('❌ Error validating Phase B:', error);
    try {
      await db.close();
    } catch {
      // Ignore
    }
    process.exit(1);
  }
}

function extractKeywords(title: string, body: string): string[] {
  const text = `${title} ${body}`.toLowerCase();
  const keywords = new Set<string>();

  const featureKeywords = [
    'gmail',
    'slack',
    'discord',
    'email',
    'cc',
    'bcc',
    'inbox',
    'filter',
    'notification',
    'sync',
    'oauth',
    'auth',
    'ui',
    'bug',
    'feature',
    'todo',
    'task',
  ];

  for (const keyword of featureKeywords) {
    if (text.includes(keyword)) {
      keywords.add(keyword);
    }
  }

  const issueMatches = text.match(/\bTEN-\d+\b/gi);
  if (issueMatches) {
    issueMatches.forEach((match) => keywords.add(match.toUpperCase()));
  }

  return Array.from(keywords);
}

function calculateKeywordScore(
  issueKeywords: string[],
  feedbackKeywords: string[],
  issueId: string
): number {
  if (feedbackKeywords.length === 0 || issueKeywords.length === 0) {
    return 0;
  }

  if (feedbackKeywords.includes(issueId)) {
    return 1.0;
  }

  const issueSet = new Set(issueKeywords);
  const feedbackSet = new Set(feedbackKeywords);
  const intersection = new Set([...issueSet].filter((k) => feedbackSet.has(k)));
  const union = new Set([...issueSet, ...feedbackSet]);

  return intersection.size / union.size;
}

// Run validation
validatePhaseB();
