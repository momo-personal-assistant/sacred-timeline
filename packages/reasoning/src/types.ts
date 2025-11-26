import type { CanonicalObject } from '@unified-memory/shared';

/**
 * Configuration for the reasoning module
 */
export interface ReasoningConfig {
  /** Maximum number of sources to include (default: 5) */
  maxSources?: number;
  /** Maximum length of snippets (default: 150) */
  snippetLength?: number;
}

/**
 * Reference to a source document
 */
export interface SourceReference {
  id: string;
  title?: string;
  platform: string;
  relevanceScore: number;
  snippet?: string;
}

/**
 * Result of the reasoning process
 */
export interface ReasoningResult {
  query: string;
  answer: string;
  sources: SourceReference[];
  confidence: number;
  metadata?: {
    processingTimeMs?: number;
    modelUsed?: string;
  };
}

/**
 * Context from retrieval to be processed by reasoning
 */
export interface RetrievalContext {
  query: string;
  objects: CanonicalObject[];
  chunks: Array<{
    id: string;
    content: string;
    canonical_object_id: string;
    similarity: number;
  }>;
}
