/**
 * @momo/chunking
 *
 * Text chunking strategies for the memory pipeline.
 * Part of Write Path: Ingestion → Transform → Consolidation → [Chunking] → Embedding
 */

export { Chunker } from './chunker';
export type { Chunk, ChunkingConfig, ChunkingStrategy, ChunkingStats } from './chunker';
