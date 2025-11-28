import { RelationInferrer } from '@momo/graph';
import { getDb } from '@unified-memory/db';
import type { CanonicalObject } from '@unified-memory/db';
import { NextResponse } from 'next/server';

/**
 * Match Linear issues with Notion feedback using RelationInferrer
 * Supports both keyword-based and embedding-based similarity
 */

interface MatchResult {
  issueId: string;
  issueTitle: string;
  feedbackId: string;
  feedbackTitle: string;
  matchScore: number;
  matchReasons: string[];
  method: 'keyword' | 'embedding' | 'hybrid';
}

interface MatchParams {
  issueIds?: string[];
  minScore: number;
  useEmbeddings: boolean;
  persistMatches: boolean;
  workspace: string;
}

async function matchFeedback(params: MatchParams) {
  const { issueIds, minScore, useEmbeddings, persistMatches, workspace } = params;

  const db = await getDb();
  const pool = (db as any).pool;

  // Fetch Linear issues
  const issuesQuery = issueIds
    ? `SELECT * FROM canonical_objects WHERE platform = 'linear' AND object_type = 'issue' AND id = ANY($1::text[])`
    : `SELECT * FROM canonical_objects WHERE platform = 'linear' AND object_type = 'issue' AND id LIKE $1`;

  const issuesResult = await pool.query(
    issuesQuery,
    issueIds
      ? [issueIds.map((id: string) => `linear|${workspace}|issue|${id}`)]
      : [`linear|${workspace}|%`]
  );

  // Fetch Notion feedback
  const feedbackResult = await pool.query(
    `SELECT * FROM canonical_objects
       WHERE platform = 'notion'
         AND object_type IN ('meeting_note', 'feedback', 'page')
         AND id LIKE $1`,
    [`notion|${workspace}|%`]
  );

  const issues: CanonicalObject[] = issuesResult.rows;
  const feedback: CanonicalObject[] = feedbackResult.rows;
  const allObjects = [...issues, ...feedback];

  console.log(`\n📊 Matching: ${issues.length} issues × ${feedback.length} feedback`);

  // Fetch embeddings if requested
  const embeddings = new Map<string, number[]>();
  if (useEmbeddings) {
    const embeddingsResult = await pool.query(
      `SELECT canonical_object_id, embedding FROM chunks WHERE canonical_object_id = ANY($1::text[])`,
      [allObjects.map((obj) => obj.id)]
    );

    for (const row of embeddingsResult.rows) {
      // Parse embedding from string to number array (pgvector returns as string)
      let embedding: number[];
      if (typeof row.embedding === 'string') {
        embedding = JSON.parse(row.embedding);
      } else {
        embedding = row.embedding;
      }
      embeddings.set(row.canonical_object_id, embedding);
    }

    console.log(`  ✓ Loaded ${embeddings.size} embeddings`);
  }

  // Initialize RelationInferrer
  const inferrer = new RelationInferrer({
    similarityThreshold: minScore,
    keywordOverlapThreshold: minScore,
    useSemanticSimilarity: useEmbeddings && embeddings.size > 0,
    semanticWeight: 0.7, // 70% semantic, 30% keyword
    includeInferred: true,
  });

  // Infer relations
  let relations;
  if (useEmbeddings && embeddings.size > 0) {
    relations = inferrer.inferSimilarityWithEmbeddings(allObjects, embeddings);
  } else {
    relations = inferrer.inferSimilarity(allObjects);
  }

  // Filter to only issue→feedback relations
  const matches: MatchResult[] = [];
  for (const rel of relations) {
    const fromPlatform = rel.from_id.split('|')[0];
    const toPlatform = rel.to_id.split('|')[0];

    const isIssue = fromPlatform === 'linear';
    const isFeedback = toPlatform === 'notion';

    if (isIssue && isFeedback) {
      const issueShortId = rel.from_id.split('|').pop() || rel.from_id;
      const feedbackShortId = rel.to_id.split('|').pop() || rel.to_id;

      // Find full objects for titles
      const issueObj = issues.find((i) => i.id === rel.from_id);
      const feedbackObj = feedback.find((f) => f.id === rel.to_id);

      const matchReasons: string[] = [];
      const method = rel.metadata?.semantic_similarity
        ? rel.metadata?.keyword_similarity
          ? 'hybrid'
          : 'embedding'
        : 'keyword';

      if (rel.metadata?.semantic_similarity) {
        matchReasons.push(
          `Semantic similarity: ${(rel.metadata.semantic_similarity * 100).toFixed(1)}%`
        );
      }

      if (rel.metadata?.keyword_similarity) {
        matchReasons.push(
          `Keyword overlap: ${(rel.metadata.keyword_similarity * 100).toFixed(1)}%`
        );
      }

      if (rel.metadata?.shared_keywords && rel.metadata.shared_keywords.length > 0) {
        matchReasons.push(`Keywords: ${rel.metadata.shared_keywords.slice(0, 3).join(', ')}`);
      }

      matches.push({
        issueId: issueShortId,
        issueTitle: issueObj?.title || '',
        feedbackId: feedbackShortId,
        feedbackTitle: feedbackObj?.title || '',
        matchScore: Math.round(rel.confidence * 100) / 100,
        matchReasons,
        method,
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.matchScore - a.matchScore);

  console.log(`  ✓ Found ${matches.length} issue→feedback matches`);

  // Persist matches to database if requested
  let persistedCount = 0;
  if (persistMatches && matches.length > 0) {
    persistedCount = await persistMatchesToDb(pool, matches, workspace);
  }

  const avgScore =
    matches.length > 0 ? matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length : 0;

  return {
    success: true,
    matches,
    summary: {
      totalMatches: matches.length,
      avgScore: Math.round(avgScore * 100) / 100,
      highConfidence: matches.filter((m) => m.matchScore >= 0.7).length,
      mediumConfidence: matches.filter((m) => m.matchScore >= 0.5 && m.matchScore < 0.7).length,
      lowConfidence: matches.filter((m) => m.matchScore < 0.5).length,
      persistedCount,
      method: useEmbeddings && embeddings.size > 0 ? 'hybrid' : 'keyword-only',
    },
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const params: MatchParams = {
      minScore: parseFloat(searchParams.get('minScore') || '0.3'),
      useEmbeddings: searchParams.get('useEmbeddings') !== 'false',
      persistMatches: searchParams.get('persistMatches') === 'true',
      workspace: searchParams.get('workspace') || 'tenxai',
    };

    const result = await matchFeedback(params);
    return NextResponse.json(result);
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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const params: MatchParams = {
      issueIds: body.issueIds,
      minScore: body.minScore ?? 0.3,
      useEmbeddings: body.useEmbeddings ?? true,
      persistMatches: body.persistMatches ?? false,
      workspace: body.workspace || 'tenxai',
    };

    const result = await matchFeedback(params);
    return NextResponse.json(result);
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
