import { z } from 'zod';

/**
 * Platform-specific types for transformers
 */

/**
 * Supported platforms
 */
export enum Platform {
  SLACK = 'slack',
  DISCORD = 'discord',
  EMAIL = 'email',
  NOTION = 'notion',
  LINEAR = 'linear',
  GITHUB = 'github',
  CUSTOM = 'custom',
}

/**
 * Base transformer input
 */
export const TransformerInputSchema = z.object({
  platform: z.nativeEnum(Platform),
  rawData: z.unknown(),
  metadata: z.record(z.unknown()).optional(),
});

export type TransformerInput = z.infer<typeof TransformerInputSchema>;

/**
 * Transformer output (normalized memory format)
 */
export const TransformerOutputSchema = z.object({
  content: z.string(),
  metadata: z.record(z.unknown()),
  platform: z.nativeEnum(Platform),
  extractedAt: z.string().datetime(),
});

export type TransformerOutput = z.infer<typeof TransformerOutputSchema>;
