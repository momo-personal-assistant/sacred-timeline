/**
 * Text Chunking Strategies
 *
 * Splits text into chunks for embedding
 */

import type { CanonicalObject } from '@unified-memory/shared/types/canonical';

export interface Chunk {
  id: string; // Format: "platform|workspace|type|id:chunk:N"
  canonical_object_id: string;
  chunk_index: number;
  content: string;
  method: 'fixed-size' | 'semantic' | 'relational';
  metadata?: Record<string, any>;
}

export interface ChunkingConfig {
  strategy: 'fixed-size' | 'semantic' | 'relational';
  maxChunkSize?: number; // For fixed-size strategy
  overlap?: number; // For fixed-size strategy
  preserveMetadata?: boolean;
}

export class Chunker {
  private config: ChunkingConfig;

  constructor(config: ChunkingConfig) {
    this.config = {
      maxChunkSize: config.maxChunkSize || 500,
      overlap: config.overlap || 50,
      preserveMetadata: config.preserveMetadata !== false,
      ...config,
    };
  }

  /**
   * Chunk a canonical object into multiple chunks
   */
  chunk(obj: CanonicalObject): Chunk[] {
    switch (this.config.strategy) {
      case 'fixed-size':
        return this.chunkFixedSize(obj);
      case 'semantic':
        return this.chunkSemantic(obj);
      case 'relational':
        return this.chunkRelational(obj);
      default:
        throw new Error(`Unknown chunking strategy: ${this.config.strategy}`);
    }
  }

  /**
   * Fixed-size chunking with overlap
   * Simple but effective baseline
   */
  private chunkFixedSize(obj: CanonicalObject): Chunk[] {
    const chunks: Chunk[] = [];
    const text = this.extractText(obj);

    if (!text || text.length === 0) {
      return chunks;
    }

    const maxSize = this.config.maxChunkSize!;
    const overlap = this.config.overlap!;

    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < text.length) {
      const endIndex = Math.min(startIndex + maxSize, text.length);
      const chunkText = text.slice(startIndex, endIndex);

      chunks.push({
        id: `${obj.id}:chunk:${chunkIndex}`,
        canonical_object_id: obj.id,
        chunk_index: chunkIndex,
        content: chunkText,
        method: 'fixed-size',
        metadata: this.config.preserveMetadata
          ? {
              char_start: startIndex,
              char_end: endIndex,
              platform: obj.platform,
              object_type: obj.object_type,
              title: obj.title,
              created_at: obj.timestamps.created_at,
            }
          : undefined,
      });

      chunkIndex++;
      startIndex += maxSize - overlap;

      // Avoid creating tiny last chunks
      if (text.length - startIndex < overlap) {
        break;
      }
    }

    return chunks;
  }

  /**
   * Semantic chunking
   * Splits on natural boundaries (paragraphs, sentences)
   */
  private chunkSemantic(obj: CanonicalObject): Chunk[] {
    const chunks: Chunk[] = [];
    const text = this.extractText(obj);

    if (!text || text.length === 0) {
      return chunks;
    }

    // Split on double newlines (paragraphs)
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

    let chunkIndex = 0;
    let currentChunk = '';
    let charStart = 0;

    for (const paragraph of paragraphs) {
      // If adding this paragraph exceeds max size, save current chunk
      if (
        currentChunk.length > 0 &&
        currentChunk.length + paragraph.length > this.config.maxChunkSize!
      ) {
        chunks.push({
          id: `${obj.id}:chunk:${chunkIndex}`,
          canonical_object_id: obj.id,
          chunk_index: chunkIndex,
          content: currentChunk.trim(),
          method: 'semantic',
          metadata: this.config.preserveMetadata
            ? {
                char_start: charStart,
                char_end: charStart + currentChunk.length,
                platform: obj.platform,
                object_type: obj.object_type,
                title: obj.title,
                created_at: obj.timestamps.created_at,
              }
            : undefined,
        });

        chunkIndex++;
        charStart += currentChunk.length;
        currentChunk = '';
      }

      currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + paragraph;
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push({
        id: `${obj.id}:chunk:${chunkIndex}`,
        canonical_object_id: obj.id,
        chunk_index: chunkIndex,
        content: currentChunk.trim(),
        method: 'semantic',
        metadata: this.config.preserveMetadata
          ? {
              char_start: charStart,
              char_end: charStart + currentChunk.length,
              platform: obj.platform,
              object_type: obj.object_type,
              title: obj.title,
              created_at: obj.timestamps.created_at,
            }
          : undefined,
      });
    }

    return chunks;
  }

  /**
   * Relational chunking
   * Preserves structure: title, body, metadata as separate chunks
   */
  private chunkRelational(obj: CanonicalObject): Chunk[] {
    const chunks: Chunk[] = [];
    let chunkIndex = 0;

    // Chunk 0: Title + metadata
    if (obj.title) {
      const titleChunk = this.buildTitleChunk(obj);
      chunks.push({
        id: `${obj.id}:chunk:${chunkIndex}`,
        canonical_object_id: obj.id,
        chunk_index: chunkIndex,
        content: titleChunk,
        method: 'relational',
        metadata: {
          chunk_type: 'title',
          platform: obj.platform,
          object_type: obj.object_type,
          created_at: obj.timestamps.created_at,
        },
      });
      chunkIndex++;
    }

    // Chunk 1+: Body (split if too long)
    if (obj.body) {
      const bodyChunks = this.chunkFixedSize({
        ...obj,
        title: undefined, // Don't include title in body chunks
      });

      for (const bodyChunk of bodyChunks) {
        chunks.push({
          ...bodyChunk,
          id: `${obj.id}:chunk:${chunkIndex}`,
          chunk_index: chunkIndex,
          method: 'relational',
          metadata: {
            ...bodyChunk.metadata,
            chunk_type: 'body',
          },
        });
        chunkIndex++;
      }
    }

    return chunks;
  }

  /**
   * Extract full text from canonical object
   */
  private extractText(obj: CanonicalObject): string {
    const parts: string[] = [];

    if (obj.title) {
      parts.push(obj.title);
    }

    if (obj.body) {
      parts.push(obj.body);
    }

    return parts.join('\n\n');
  }

  /**
   * Build title chunk with metadata
   */
  private buildTitleChunk(obj: CanonicalObject): string {
    const parts: string[] = [];

    parts.push(`Title: ${obj.title}`);
    parts.push(`Platform: ${obj.platform}`);
    parts.push(`Type: ${obj.object_type}`);

    if (obj.properties?.status) {
      parts.push(`Status: ${obj.properties.status}`);
    }

    if (obj.properties?.priority) {
      parts.push(`Priority: ${obj.properties.priority}`);
    }

    if (obj.properties?.labels && obj.properties.labels.length > 0) {
      parts.push(`Labels: ${obj.properties.labels.join(', ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Get statistics about chunking
   */
  getStats(chunks: Chunk[]): {
    total_chunks: number;
    avg_chunk_size: number;
    min_chunk_size: number;
    max_chunk_size: number;
    std_chunk_size: number;
  } {
    if (chunks.length === 0) {
      return {
        total_chunks: 0,
        avg_chunk_size: 0,
        min_chunk_size: 0,
        max_chunk_size: 0,
        std_chunk_size: 0,
      };
    }

    const sizes = chunks.map((c) => c.content.length);
    const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - avg, 2), 0) / sizes.length;
    const std = Math.sqrt(variance);

    return {
      total_chunks: chunks.length,
      avg_chunk_size: Math.round(avg),
      min_chunk_size: Math.min(...sizes),
      max_chunk_size: Math.max(...sizes),
      std_chunk_size: Math.round(std),
    };
  }
}
