#!/usr/bin/env tsx
/**
 * Test RelationInferrer with real data
 */

import { RelationInferrer } from '@momo/graph';
import { getDb } from '@unified-memory/db';
import type { CanonicalObject } from '@unified-memory/db';

async function testRelationInferrer() {
  const db = await getDb();
  const pool = (db as any).pool;

  try {
    const workspace = 'tenxai';

    // Fetch Linear issues
    const issuesResult = await pool.query(
      `SELECT * FROM canonical_objects WHERE platform = 'linear' AND object_type = 'issue' AND id LIKE $1`,
      [`linear|${workspace}|%`]
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

    console.log(`\n📊 Test data:`);
    console.log(`  - Issues: ${issues.length}`);
    console.log(`  - Feedback: ${feedback.length}`);
    console.log(`  - Total: ${allObjects.length}`);

    // Fetch embeddings
    const embeddingsResult = await pool.query(
      `SELECT canonical_object_id, embedding FROM chunks WHERE canonical_object_id = ANY($1::text[])`,
      [allObjects.map((obj) => obj.id)]
    );

    console.log(`  - Embeddings: ${embeddingsResult.rows.length}`);

    const embeddings = new Map<string, number[]>();
    for (const row of embeddingsResult.rows) {
      // Parse embedding from string to number array
      let embedding: number[];
      if (typeof row.embedding === 'string') {
        // pgvector returns as string like "[-0.06,0.03,...]"
        embedding = JSON.parse(row.embedding);
      } else {
        embedding = row.embedding;
      }

      embeddings.set(row.canonical_object_id, embedding);
    }

    console.log(`  ✓ Parsed ${embeddings.size} embeddings`);

    console.log(`\n🔍 Testing RelationInferrer...`);

    const startTime = Date.now();

    const inferrer = new RelationInferrer({
      similarityThreshold: 0.3,
      keywordOverlapThreshold: 0.3,
      useSemanticSimilarity: true,
      semanticWeight: 0.7,
      includeInferred: true,
    });

    const relations = inferrer.inferSimilarityWithEmbeddings(allObjects, embeddings);

    const endTime = Date.now();

    console.log(`\n✅ Test complete:`);
    console.log(`  - Time: ${endTime - startTime}ms`);
    console.log(`  - Relations found: ${relations.length}`);

    // Show first 5 relations
    console.log(`\n📋 Sample relations:`);
    for (let i = 0; i < Math.min(5, relations.length); i++) {
      const rel = relations[i];
      console.log(`  ${i + 1}. ${rel.from_id} → ${rel.to_id}`);
      console.log(`     Confidence: ${rel.confidence}`);
      console.log(`     Type: ${rel.type}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await db.close();
  }
}

testRelationInferrer().catch(console.error);
