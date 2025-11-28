/**
 * Environment variable validation using Zod
 *
 * This module provides type-safe access to environment variables
 * and fails fast if required variables are missing in production.
 */

import { z } from 'zod';

/**
 * Database environment schema
 */
const dbEnvSchema = z.object({
  POSTGRES_HOST: z.string().min(1, 'POSTGRES_HOST is required'),
  POSTGRES_PORT: z.string().regex(/^\d+$/, 'POSTGRES_PORT must be a number').transform(Number),
  POSTGRES_DB: z.string().min(1, 'POSTGRES_DB is required'),
  POSTGRES_USER: z.string().min(1, 'POSTGRES_USER is required'),
  POSTGRES_PASSWORD: z.string().min(1, 'POSTGRES_PASSWORD is required'),
  POSTGRES_MAX_CONNECTIONS: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
  VECTOR_DIMENSIONS: z.string().regex(/^\d+$/).transform(Number).optional().default('1536'),
});

/**
 * OpenAI environment schema
 */
const openaiEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required').optional(),
  OPENAI_EMBEDDING_MODEL: z.string().optional().default('text-embedding-3-small'),
});

/**
 * Application environment schema
 */
const appEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
  WORKSPACE: z.string().optional().default('sample'),
});

/**
 * Combined environment schema for full validation
 */
const fullEnvSchema = dbEnvSchema.merge(openaiEnvSchema).merge(appEnvSchema);

export type DbEnv = z.infer<typeof dbEnvSchema>;
export type OpenAIEnv = z.infer<typeof openaiEnvSchema>;
export type AppEnv = z.infer<typeof appEnvSchema>;
export type FullEnv = z.infer<typeof fullEnvSchema>;

/**
 * Validation error with detailed information
 */
export class EnvValidationError extends Error {
  public readonly missingVars: string[];
  public readonly invalidVars: { key: string; message: string }[];

  constructor(missingVars: string[], invalidVars: { key: string; message: string }[]) {
    const messages: string[] = [];

    if (missingVars.length > 0) {
      messages.push(`Missing environment variables: ${missingVars.join(', ')}`);
    }

    if (invalidVars.length > 0) {
      const invalidMessages = invalidVars.map((v) => `${v.key}: ${v.message}`).join('; ');
      messages.push(`Invalid environment variables: ${invalidMessages}`);
    }

    super(messages.join('\n'));
    this.name = 'EnvValidationError';
    this.missingVars = missingVars;
    this.invalidVars = invalidVars;
  }
}

/**
 * Parse Zod error into structured format
 */
function parseZodError(error: z.ZodError): {
  missingVars: string[];
  invalidVars: { key: string; message: string }[];
} {
  const missingVars: string[] = [];
  const invalidVars: { key: string; message: string }[] = [];

  for (const issue of error.issues) {
    const key = issue.path[0] as string;
    if (issue.code === 'invalid_type' && issue.received === 'undefined') {
      missingVars.push(key);
    } else {
      invalidVars.push({ key, message: issue.message });
    }
  }

  return { missingVars, invalidVars };
}

/**
 * Validate database environment variables
 * @throws EnvValidationError if validation fails
 */
export function validateDbEnv(env: NodeJS.ProcessEnv = process.env): DbEnv {
  const result = dbEnvSchema.safeParse(env);

  if (!result.success) {
    const { missingVars, invalidVars } = parseZodError(result.error);
    throw new EnvValidationError(missingVars, invalidVars);
  }

  return result.data;
}

/**
 * Validate OpenAI environment variables
 * @throws EnvValidationError if validation fails
 */
export function validateOpenAIEnv(env: NodeJS.ProcessEnv = process.env): OpenAIEnv {
  const result = openaiEnvSchema.safeParse(env);

  if (!result.success) {
    const { missingVars, invalidVars } = parseZodError(result.error);
    throw new EnvValidationError(missingVars, invalidVars);
  }

  return result.data;
}

/**
 * Validate all environment variables
 * @throws EnvValidationError if validation fails
 */
export function validateFullEnv(env: NodeJS.ProcessEnv = process.env): FullEnv {
  const result = fullEnvSchema.safeParse(env);

  if (!result.success) {
    const { missingVars, invalidVars } = parseZodError(result.error);
    throw new EnvValidationError(missingVars, invalidVars);
  }

  return result.data;
}

/**
 * Check if we're in production environment
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if we're in test environment
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Get database config with validation
 * In development, uses defaults if env vars are missing
 * In production, throws if env vars are missing
 */
export function getDbConfig(env: NodeJS.ProcessEnv = process.env): DbEnv {
  // In production, strictly validate
  if (isProduction()) {
    return validateDbEnv(env);
  }

  // In development/test, use defaults for missing values
  const withDefaults = {
    POSTGRES_HOST: env.POSTGRES_HOST || 'localhost',
    POSTGRES_PORT: env.POSTGRES_PORT || '5434',
    POSTGRES_DB: env.POSTGRES_DB || 'unified_memory',
    POSTGRES_USER: env.POSTGRES_USER || 'unified_memory',
    POSTGRES_PASSWORD: env.POSTGRES_PASSWORD || 'unified_memory_dev',
    POSTGRES_MAX_CONNECTIONS: env.POSTGRES_MAX_CONNECTIONS || '20',
    VECTOR_DIMENSIONS: env.VECTOR_DIMENSIONS || '1536',
  };

  return validateDbEnv(withDefaults as unknown as NodeJS.ProcessEnv);
}

/**
 * Get test database config
 * Uses separate port and database for test environment
 */
export function getTestDbConfig(): DbEnv {
  return {
    POSTGRES_HOST: process.env.POSTGRES_TEST_HOST || 'localhost',
    POSTGRES_PORT: parseInt(process.env.POSTGRES_TEST_PORT || '5435', 10),
    POSTGRES_DB: process.env.POSTGRES_TEST_DB || 'unified_memory_test',
    POSTGRES_USER: process.env.POSTGRES_TEST_USER || 'unified_memory',
    POSTGRES_PASSWORD: process.env.POSTGRES_TEST_PASSWORD || 'unified_memory_dev',
    POSTGRES_MAX_CONNECTIONS: parseInt(process.env.POSTGRES_TEST_MAX_CONNECTIONS || '10', 10),
    VECTOR_DIMENSIONS: parseInt(process.env.VECTOR_DIMENSIONS || '1536', 10),
  };
}
