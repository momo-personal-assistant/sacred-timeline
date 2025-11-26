/**
 * Storage Stage
 *
 * Persists chunks and embeddings to the database.
 */

import type { PipelineContext, PipelineStage, StorageStageResult } from '../types';

export class StorageStage implements PipelineStage {
  readonly name = 'storage';
  readonly description = 'Persist chunks and embeddings to database';

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { chunks, embeddings, objects, db } = context;

    if (chunks.length === 0) {
      throw new Error('No chunks to store. Run chunking stage first.');
    }

    if (embeddings.size === 0) {
      throw new Error('No embeddings to store. Run embedding stage first.');
    }

    const pool = (db as any).pool;

    // Delete existing chunks for these objects
    const objectIds = objects.map((o) => o.id);
    const beforeDelete = await pool.query(
      'SELECT COUNT(*) as count FROM chunks WHERE canonical_object_id = ANY($1)',
      [objectIds]
    );
    const deletedCount = parseInt(beforeDelete.rows[0].count);

    if (deletedCount > 0) {
      await pool.query('DELETE FROM chunks WHERE canonical_object_id = ANY($1)', [objectIds]);
      await this.logActivity(context, {
        action: 'DELETE',
        table: 'chunks',
        rows_affected: deletedCount,
        object_ids: objectIds,
      });
    }

    // Insert new chunks with embeddings
    let chunksStored = 0;
    for (const chunk of chunks) {
      const embedding = embeddings.get(chunk.id);
      if (!embedding) {
        console.warn(`No embedding found for chunk ${chunk.id}, skipping`);
        continue;
      }

      await pool.query(
        `INSERT INTO chunks (
          id, canonical_object_id, chunk_index, content, method, metadata, embedding
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          chunk.id,
          chunk.canonical_object_id,
          chunk.chunk_index,
          chunk.content,
          chunk.method,
          chunk.metadata ? JSON.stringify(chunk.metadata) : null,
          `[${embedding.join(',')}]`,
        ]
      );
      chunksStored++;
    }

    // Log storage activity
    await this.logActivity(context, {
      action: 'INSERT',
      table: 'chunks',
      rows_affected: chunksStored,
      deleted_count: deletedCount,
    });

    return context;
  }

  shouldRun(context: PipelineContext): boolean {
    return context.chunks.length > 0 && context.embeddings.size > 0;
  }

  private async logActivity(
    context: PipelineContext,
    details: Record<string, unknown>
  ): Promise<void> {
    const pool = (context.db as any).pool;
    if (!pool) return;

    const isDelete = details.action === 'DELETE';
    const operationType = isDelete ? 'data_delete' : 'data_insert';
    const description = isDelete
      ? `Deleted ${details.rows_affected} existing chunks`
      : `Saved ${details.rows_affected} chunks with embeddings`;

    try {
      await pool.query(
        `INSERT INTO research_activity_log (
          operation_type, operation_name, description, status, triggered_by, details, experiment_id
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        [
          operationType,
          `${details.action} chunks`,
          description,
          'completed',
          'pipeline',
          JSON.stringify(details),
          context.experimentId || null,
        ]
      );
    } catch {
      // Ignore logging errors
    }
  }

  /**
   * Run storage stage standalone and return results
   */
  async runStandalone(context: PipelineContext): Promise<StorageStageResult> {
    const initialChunkCount = context.chunks.length;
    await this.execute(context);
    return {
      chunksStored: initialChunkCount,
      relationsStored: 0, // Relations stored in separate stage if needed
    };
  }
}
