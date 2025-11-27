import { UnifiedMemoryDB } from '@unified-memory/db';
import { NextResponse } from 'next/server';

/**
 * Match Linear issues with Notion feedback based on:
 * 1. Keyword overlap (feature names, issue IDs)
 * 2. Time proximity (issue completion ± 30 days)
 */

interface MatchResult {
  issueId: string;
  feedbackId: string;
  matchScore: number;
  matchReasons: string[];
}

export async function POST(request: Request) {
  const db = new UnifiedMemoryDB({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    vectorDimensions: parseInt(process.env.VECTOR_DIMENSIONS || '1536', 10),
  });

  try {
    const body = await request.json();
    const { issueIds, minScore = 0.3 } = body;

    await db.initialize();
    const pool = (
      db as unknown as {
        pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
      }
    ).pool;

    // Fetch Linear issues
    const issuesQuery = issueIds
      ? `SELECT * FROM canonical_objects WHERE platform = 'linear' AND object_type = 'issue' AND id = ANY($1::text[])`
      : `SELECT * FROM canonical_objects WHERE platform = 'linear' AND object_type = 'issue' AND properties->>'status' = 'Done'`;

    const issuesResult = await pool.query(
      issuesQuery,
      issueIds ? [issueIds.map((id: string) => `linear|tenxai|issue|${id}`)] : []
    );

    // Fetch Notion feedback
    const feedbackResult = await pool.query(`
      SELECT * FROM canonical_objects
      WHERE platform = 'notion' AND object_type IN ('meeting_note', 'feedback', 'page')
    `);

    const matches: MatchResult[] = [];

    // Match each issue with feedback
    for (const issueRow of issuesResult.rows) {
      const issue = issueRow as any;
      const issueShortId = issue.id.split('|').pop();
      const issueKeywords = extractKeywords(issue.title, issue.body);
      const issueCompletedAt = issue.timestamps.updated_at || issue.timestamps.created_at;

      for (const feedbackRow of feedbackResult.rows) {
        const feedback = feedbackRow as any;
        const feedbackShortId = feedback.id.split('|').pop();
        const feedbackKeywords = feedback.properties?.keywords || [];
        const feedbackCreatedAt = feedback.timestamps.created_at;

        // Calculate match score
        const keywordScore = calculateKeywordScore(issueKeywords, feedbackKeywords, issueShortId);
        const timeScore = calculateTimeScore(issueCompletedAt, feedbackCreatedAt);
        const totalScore = keywordScore * 0.7 + timeScore * 0.3;

        const matchReasons: string[] = [];
        if (keywordScore > 0.5) {
          matchReasons.push(
            `Keyword overlap: ${Array.from(new Set([...issueKeywords].filter((k) => feedbackKeywords.includes(k)))).join(', ')}`
          );
        }
        if (timeScore > 0.5) {
          const daysDiff = Math.abs(
            (new Date(feedbackCreatedAt).getTime() - new Date(issueCompletedAt).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          matchReasons.push(`Time proximity: ${Math.round(daysDiff)} days apart`);
        }
        if (feedbackKeywords.includes(issueShortId)) {
          matchReasons.push(`Direct issue reference: ${issueShortId}`);
        }

        if (totalScore >= minScore) {
          matches.push({
            issueId: issueShortId,
            feedbackId: feedbackShortId,
            matchScore: Math.round(totalScore * 100) / 100,
            matchReasons,
          });
        }
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.matchScore - a.matchScore);

    await db.close();

    return NextResponse.json({
      success: true,
      matches,
      summary: {
        totalMatches: matches.length,
        highConfidence: matches.filter((m) => m.matchScore >= 0.7).length,
        mediumConfidence: matches.filter((m) => m.matchScore >= 0.5 && m.matchScore < 0.7).length,
        lowConfidence: matches.filter((m) => m.matchScore < 0.5).length,
      },
    });
  } catch (error) {
    console.error('Error matching feedback:', error);
    try {
      await db.close();
    } catch {
      // Ignore close error
    }
    return NextResponse.json(
      {
        error: 'Failed to match feedback',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Extract keywords from title and body
 */
function extractKeywords(title: string, body: string): string[] {
  const text = `${title} ${body}`.toLowerCase();
  const keywords = new Set<string>();

  // Common feature keywords
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

  // Extract Linear issue IDs
  const issueMatches = text.match(/\bTEN-\d+\b/gi);
  if (issueMatches) {
    issueMatches.forEach((match) => keywords.add(match.toUpperCase()));
  }

  return Array.from(keywords);
}

/**
 * Calculate keyword overlap score (0-1)
 */
function calculateKeywordScore(
  issueKeywords: string[],
  feedbackKeywords: string[],
  issueId: string
): number {
  if (feedbackKeywords.length === 0 || issueKeywords.length === 0) {
    return 0;
  }

  // Boost score if issue ID is directly mentioned
  if (feedbackKeywords.includes(issueId)) {
    return 1.0;
  }

  // Calculate Jaccard similarity
  const issueSet = new Set(issueKeywords);
  const feedbackSet = new Set(feedbackKeywords);
  const intersection = new Set([...issueSet].filter((k) => feedbackSet.has(k)));
  const union = new Set([...issueSet, ...feedbackSet]);

  return intersection.size / union.size;
}

/**
 * Calculate time proximity score (0-1)
 * Issue completion within ±30 days of feedback gets higher score
 */
function calculateTimeScore(issueDate: string, feedbackDate: string): number {
  const issueDateObj = new Date(issueDate);
  const feedbackDateObj = new Date(feedbackDate);

  const daysDiff = Math.abs(
    (feedbackDateObj.getTime() - issueDateObj.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Within 7 days: 1.0
  // Within 30 days: 0.5
  // Beyond 30 days: exponential decay
  if (daysDiff <= 7) {
    return 1.0;
  } else if (daysDiff <= 30) {
    return 0.5 + (0.5 * (30 - daysDiff)) / 23;
  } else {
    return Math.max(0, 0.5 * Math.exp(-0.05 * (daysDiff - 30)));
  }
}
