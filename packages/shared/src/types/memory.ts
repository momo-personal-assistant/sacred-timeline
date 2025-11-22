import { z } from 'zod';

/**
 * Core memory types for the unified memory system
 */

/**
 * Memory metadata - flexible key-value store for platform-specific data
 */
export const MemoryMetadataSchema = z.record(z.unknown());
export type MemoryMetadata = z.infer<typeof MemoryMetadataSchema>;

/**
 * Memory entry - the unified format for all memories
 */
export const MemorySchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1),
  embeddings: z.array(z.number()).optional(),
  metadata: MemoryMetadataSchema.optional(),
  tags: z.array(z.string()).optional(),
  platform: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Memory = z.infer<typeof MemorySchema>;

/**
 * Input for creating a new memory
 */
export const CreateMemoryInputSchema = z.object({
  content: z.string().min(1),
  metadata: MemoryMetadataSchema.optional(),
  tags: z.array(z.string()).optional(),
  platform: z.string().optional(),
});

export type CreateMemoryInput = z.infer<typeof CreateMemoryInputSchema>;

/**
 * Search query for retrieving memories
 */
export const MemorySearchQuerySchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  tags: z.array(z.string()).optional(),
  platform: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type MemorySearchQuery = z.infer<typeof MemorySearchQuerySchema>;
