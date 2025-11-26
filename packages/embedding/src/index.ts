/**
 * @momo/embedding
 *
 * Embedding generation for the memory pipeline.
 * Part of Write Path: Ingestion → Transform → Consolidation → Chunking → [Embedding]
 *
 * Note: Chunking has been moved to @momo/chunking package
 */

export { OpenAIEmbedder } from './openai-embedder';
export type { EmbeddingConfig, EmbeddingResult, BatchEmbeddingResult } from './openai-embedder';
