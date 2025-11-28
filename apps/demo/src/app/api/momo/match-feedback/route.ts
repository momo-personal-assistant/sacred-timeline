import { getDb } from '@unified-memory/db';
import { NextResponse } from 'next/server';

/**
 * Match Linear issues with Notion feedback based on:
 * 1. Keyword overlap (feature names, issue IDs)
 * 2. Time proximity (issue completion ± 30 days)
 *
 * Optionally persists matches to the database for later retrieval.
 */

interface MatchResult {
  issueId: string;
  feedbackId: string;
  matchScore: number;
  matchReasons: string[];
  keywordScore: number;
  timeScore: number;
}

interface MatchRequestBody {
  issueIds?: string[];
  minScore?: number;
  persistMatches?: boolean; // If true, store matches in DB
  workspace?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MatchRequestBody;
    const { issueIds, minScore = 0.3, persistMatches = false, workspace = 'tenxai' } = body;

    const db = await getDb();
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
      issueIds ? [issueIds.map((id: string) => `linear|${workspace}|issue|${id}`)] : []
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
          const overlappingKeywords = [...issueKeywords].filter((k) =>
            feedbackKeywords.includes(k)
          );
          if (overlappingKeywords.length > 0) {
            matchReasons.push(`Keyword overlap: ${overlappingKeywords.join(', ')}`);
          }
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
            keywordScore: Math.round(keywordScore * 100) / 100,
            timeScore: Math.round(timeScore * 100) / 100,
          });
        }
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.matchScore - a.matchScore);

    // Persist matches to database if requested
    let persistedCount = 0;
    if (persistMatches && matches.length > 0) {
      persistedCount = await persistMatchesToDb(pool, matches, workspace);
    }

    // Note: Don't close the singleton DB connection

    return NextResponse.json({
      success: true,
      matches,
      summary: {
        totalMatches: matches.length,
        highConfidence: matches.filter((m) => m.matchScore >= 0.7).length,
        mediumConfidence: matches.filter((m) => m.matchScore >= 0.5 && m.matchScore < 0.7).length,
        lowConfidence: matches.filter((m) => m.matchScore < 0.5).length,
        persistedCount,
      },
    });
  } catch (error) {
    console.error('Error matching feedback:', error);
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
 * Persist matches to the database by updating the relations JSONB
 * Stores the match_confidence and validated_by references
 */
async function persistMatchesToDb(
  pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  matches: MatchResult[],
  workspace: string
): Promise<number> {
  let persistedCount = 0;

  for (const match of matches) {
    const feedbackCanonicalId = `notion|${workspace}|feedback|${match.feedbackId}`;
    const issueCanonicalId = `linear|${workspace}|issue|${match.issueId}`;

    try {
      // Update feedback to add validated_by reference and match_confidence
      await pool.query(
        `
        UPDATE canonical_objects
        SET relations = COALESCE(relations, '{}'::jsonb) || jsonb_build_object(
          'validated_by', COALESCE(
            (
              SELECT jsonb_agg(DISTINCT elem)
              FROM (
                SELECT jsonb_array_elements_text(COALESCE(relations->'validated_by', '[]'::jsonb)) AS elem
                UNION
                SELECT $2::text
              ) sub
            ),
            jsonb_build_array($2)
          ),
          'match_confidence', $3::numeric
        )
        WHERE id = $1
      `,
        [feedbackCanonicalId, issueCanonicalId, match.matchScore]
      );
      persistedCount++;
    } catch (err) {
      console.error(`Failed to persist match ${match.feedbackId} -> ${match.issueId}:`, err);
    }
  }

  return persistedCount;
}

/**
 * Extract keywords from title and body
 */
function extractKeywords(title: string, body: string): string[] {
  const text = `${title || ''} ${body || ''}`.toLowerCase();
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
  // Within 30 days: 0.5 to 1.0 (linear interpolation)
  // Beyond 30 days: exponential decay
  if (daysDiff <= 7) {
    return 1.0;
  } else if (daysDiff <= 30) {
    return 0.5 + (0.5 * (30 - daysDiff)) / 23;
  } else {
    return Math.max(0, 0.5 * Math.exp(-0.05 * (daysDiff - 30)));
  }
}
