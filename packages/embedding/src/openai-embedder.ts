/**
 * OpenAI Embedding Generator
 *
 * Generates embeddings using OpenAI's text-embedding models
 */

import OpenAI from 'openai';

export interface EmbeddingConfig {
  apiKey: string;
  model?: string;
  dimensions?: number;
  batchSize?: number;
}

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  tokens: number;
}

export interface BatchEmbeddingResult {
  results: EmbeddingResult[];
  totalTokens: number;
  model: string;
}

export class OpenAIEmbedder {
  private client: OpenAI;
  private model: string;
  private dimensions?: number;
  private batchSize: number;

  constructor(config: EmbeddingConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
    this.model = config.model || 'text-embedding-3-small';
    this.dimensions = config.dimensions;
    this.batchSize = config.batchSize || 100;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
      dimensions: this.dimensions,
    });

    return {
      text,
      embedding: response.data[0].embedding,
      tokens: response.usage.total_tokens,
    };
  }

  /**
   * Generate embeddings for multiple texts in batches
   */
  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    const results: EmbeddingResult[] = [];
    let totalTokens = 0;

    // Process in batches
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);

      const response = await this.client.embeddings.create({
        model: this.model,
        input: batch,
        dimensions: this.dimensions,
      });

      // Map results back to texts
      for (let j = 0; j < batch.length; j++) {
        results.push({
          text: batch[j],
          embedding: response.data[j].embedding,
          tokens: 0, // Individual token count not available in batch
        });
      }

      totalTokens += response.usage.total_tokens;
    }

    return {
      results,
      totalTokens,
      model: this.model,
    };
  }

  /**
   * Get embedding dimensions for the current model
   */
  getEmbeddingDimensions(): number {
    if (this.dimensions) {
      return this.dimensions;
    }

    // Default dimensions for OpenAI models
    switch (this.model) {
      case 'text-embedding-3-small':
        return 1536;
      case 'text-embedding-3-large':
        return 3072;
      case 'text-embedding-ada-002':
        return 1536;
      default:
        return 1536;
    }
  }

  /**
   * Estimate cost for embedding texts
   * Based on OpenAI pricing as of 2024
   */
  estimateCost(totalTokens: number): number {
    // Pricing per 1M tokens
    const pricePerMillionTokens = this.model === 'text-embedding-3-large' ? 0.13 : 0.02;
    return (totalTokens / 1_000_000) * pricePerMillionTokens;
  }
}
