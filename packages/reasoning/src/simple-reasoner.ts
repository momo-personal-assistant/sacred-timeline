import type { ReasoningConfig, ReasoningResult, RetrievalContext, SourceReference } from './types';

/**
 * SimpleReasoner generates responses from retrieved context.
 *
 * MVP Features:
 * - Template-based response formatting
 * - Source reference generation
 * - Confidence calculation
 */
export class SimpleReasoner {
  private config: Required<ReasoningConfig>;

  constructor(config: ReasoningConfig = {}) {
    this.config = {
      maxSources: config.maxSources ?? 5,
      snippetLength: config.snippetLength ?? 150,
    };
  }

  /**
   * Generate a response from retrieval context
   */
  reason(context: RetrievalContext): ReasoningResult {
    const startTime = Date.now();

    const { query, objects, chunks } = context;
    const topObjects = objects.slice(0, this.config.maxSources);

    // Build source references
    const sources: SourceReference[] = topObjects.map((obj) => {
      const chunk = chunks.find((c) => c.canonical_object_id === obj.id);
      return {
        id: obj.id,
        title: obj.title || undefined,
        platform: obj.platform,
        relevanceScore: chunk?.similarity || 0,
        snippet: this.extractSnippet(obj.body || ''),
      };
    });

    // Generate answer
    const answer = this.formatAnswer(query, sources);
    const confidence = this.calculateConfidence(chunks);

    return {
      query,
      answer,
      sources,
      confidence,
      metadata: {
        processingTimeMs: Date.now() - startTime,
        modelUsed: 'template-based',
      },
    };
  }

  /**
   * Format answer from sources using templates
   */
  private formatAnswer(query: string, sources: SourceReference[]): string {
    if (sources.length === 0) {
      return `"${query}"에 대한 관련 정보를 찾지 못했습니다.`;
    }

    const header = `"${query}"에 대해 ${sources.length}개의 관련 정보를 찾았습니다:\n\n`;

    const body = sources
      .map((source, i) => {
        const title = source.title || '제목 없음';
        const score = Math.round(source.relevanceScore * 100);
        const snippet = source.snippet || '내용 없음';

        return `${i + 1}. [${source.platform}] ${title} (관련도: ${score}%)\n   ${snippet}`;
      })
      .join('\n\n');

    return header + body;
  }

  /**
   * Extract a snippet from text content
   */
  private extractSnippet(text: string): string {
    // Clean up whitespace
    const cleaned = text.replace(/\s+/g, ' ').trim();

    if (cleaned.length <= this.config.snippetLength) {
      return cleaned;
    }

    // Try to cut at sentence boundary
    const truncated = cleaned.substring(0, this.config.snippetLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastPeriod > this.config.snippetLength * 0.5) {
      return truncated.substring(0, lastPeriod + 1);
    } else if (lastSpace > 0) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Calculate confidence score based on chunk similarities
   */
  private calculateConfidence(chunks: RetrievalContext['chunks']): number {
    if (chunks.length === 0) return 0;

    // Average similarity of top 3 chunks
    const topChunks = chunks.slice(0, 3);
    const avgSimilarity = topChunks.reduce((sum, c) => sum + c.similarity, 0) / topChunks.length;

    return Math.round(avgSimilarity * 100) / 100;
  }

  /**
   * Generate a summary answer (future LLM integration point)
   */
  generateSummary(context: RetrievalContext): string {
    // MVP: Just return a simple concatenation
    // Future: LLM-based summarization
    const { objects } = context;
    const topObjects = objects.slice(0, 3);

    if (topObjects.length === 0) {
      return '관련 정보를 찾을 수 없습니다.';
    }

    const summaries = topObjects
      .map((obj) => {
        const title = obj.title || '제목 없음';
        const body = obj.body ? this.extractSnippet(obj.body) : '내용 없음';
        return `- ${title}: ${body}`;
      })
      .join('\n');

    return `관련 정보 요약:\n${summaries}`;
  }
}
