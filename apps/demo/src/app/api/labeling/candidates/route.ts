import { UnifiedMemoryDB } from '@unified-memory/db';
import { NextResponse } from 'next/server';

/**
 * GET /api/labeling/candidates
 *
 * Returns candidate pairs for human labeling using smart sampling:
 * 1. High similarity pairs (likely related)
 * 2. Medium similarity pairs (boundary cases - most valuable!)
 * 3. Random pairs (for negative examples)
 *
 * Excludes pairs that have already been labeled.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  const db = new UnifiedMemoryDB({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    maxConnections: 5,
    vectorDimensions: 1536,
  });

  try {
    await db.initialize();
    const pool = (db as any).pool;

    // Get all canonical objects with their average embeddings
    const objectsResult = await pool.query(`
      SELECT
        co.id,
        co.platform,
        co.object_type,
        co.title,
        SUBSTRING(co.body, 1, 500) as body_preview,
        co.actors,
        co.properties,
        (
          SELECT AVG(embedding)::vector
          FROM chunks
          WHERE canonical_object_id = co.id AND embedding IS NOT NULL
        ) as avg_embedding
      FROM canonical_objects co
      ORDER BY co.timestamps->>'created_at' DESC
    `);

    const objects = objectsResult.rows.filter((o: any) => o.avg_embedding !== null);

    if (objects.length < 2) {
      await db.close();
      return NextResponse.json({
        candidates: [],
        stats: { total: 0, labeled: 0, remaining: 0 },
      });
    }

    // Get already labeled pairs
    const labeledResult = await pool.query(`
      SELECT from_id, to_id FROM ground_truth_relations WHERE source = 'human_label'
    `);
    const labeledPairs = new Set(labeledResult.rows.map((r: any) => `${r.from_id}|${r.to_id}`));
    // Also check reverse direction
    labeledResult.rows.forEach((r: any) => {
      labeledPairs.add(`${r.to_id}|${r.from_id}`);
    });

    // Calculate similarities for all pairs and categorize
    const highSimilarity: any[] = []; // > 0.6
    const mediumSimilarity: any[] = []; // 0.35 - 0.6 (boundary cases)
    const lowSimilarity: any[] = []; // < 0.35

    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        const obj1 = objects[i];
        const obj2 = objects[j];

        // Skip if already labeled
        const pairKey = `${obj1.id}|${obj2.id}`;
        if (labeledPairs.has(pairKey)) continue;

        // Calculate cosine similarity using pg vector
        const simResult = await pool.query(`SELECT 1 - ($1::vector <=> $2::vector) as similarity`, [
          obj1.avg_embedding,
          obj2.avg_embedding,
        ]);
        const similarity = parseFloat(simResult.rows[0]?.similarity || '0');

        const pair = {
          obj1: {
            id: obj1.id,
            platform: obj1.platform,
            object_type: obj1.object_type,
            title: obj1.title,
            body_preview: obj1.body_preview,
            properties: obj1.properties,
          },
          obj2: {
            id: obj2.id,
            platform: obj2.platform,
            object_type: obj2.object_type,
            title: obj2.title,
            body_preview: obj2.body_preview,
            properties: obj2.properties,
          },
          similarity,
          sharedLabels: getSharedLabels(obj1.properties, obj2.properties),
          sameAssignee: hasSameAssignee(obj1.actors, obj2.actors),
        };

        if (similarity > 0.6) {
          highSimilarity.push(pair);
        } else if (similarity >= 0.35) {
          mediumSimilarity.push(pair);
        } else if (similarity >= 0.2) {
          // Only include some low similarity pairs
          lowSimilarity.push(pair);
        }

        // Limit total pairs to check for performance
        if (highSimilarity.length + mediumSimilarity.length + lowSimilarity.length > 500) {
          break;
        }
      }
      if (highSimilarity.length + mediumSimilarity.length + lowSimilarity.length > 500) {
        break;
      }
    }

    // Smart sampling: prioritize medium similarity (boundary cases)
    const candidates: any[] = [];
    const perCategory = Math.ceil(limit / 3);

    // Shuffle and take from each category
    const shuffle = (arr: any[]) => arr.sort(() => Math.random() - 0.5);

    // Medium similarity is most valuable for learning
    candidates.push(...shuffle(mediumSimilarity).slice(0, perCategory + 5));
    candidates.push(...shuffle(highSimilarity).slice(0, perCategory));
    candidates.push(...shuffle(lowSimilarity).slice(0, perCategory - 5));

    // Shuffle final list and limit
    const finalCandidates = shuffle(candidates).slice(0, limit);

    // Get labeling progress stats
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE source = 'human_label') as human_labeled,
        COUNT(*) as total_gt
      FROM ground_truth_relations
    `);

    const totalPossiblePairs = (objects.length * (objects.length - 1)) / 2;

    await db.close();

    return NextResponse.json({
      candidates: finalCandidates,
      stats: {
        totalObjects: objects.length,
        totalPossiblePairs,
        humanLabeled: parseInt(statsResult.rows[0]?.human_labeled || '0'),
        highSimilarityCount: highSimilarity.length,
        mediumSimilarityCount: mediumSimilarity.length,
        lowSimilarityCount: lowSimilarity.length,
      },
    });
  } catch (error) {
    console.error('Error fetching labeling candidates:', error);
    await db.close();
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
  }
}

function getSharedLabels(props1: any, props2: any): string[] {
  const labels1 = new Set(
    [...(props1?.labels || []), ...(props1?.tags || [])].map((l: string) => l?.toLowerCase())
  );

  const labels2 = new Set(
    [...(props2?.labels || []), ...(props2?.tags || [])].map((l: string) => l?.toLowerCase())
  );

  return [...labels1].filter((l) => labels2.has(l));
}

function hasSameAssignee(actors1: any, actors2: any): boolean {
  const assignees1 = new Set(actors1?.assignees || []);
  const assignees2 = new Set(actors2?.assignees || []);

  for (const a of assignees1) {
    if (assignees2.has(a)) return true;
  }
  return false;
}
