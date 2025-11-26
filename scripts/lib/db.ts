/**
 * Database Configuration Utilities
 *
 * Shared database configuration for all CLI scripts.
 * Eliminates duplication of UnifiedMemoryDB initialization.
 */

import * as dotenv from 'dotenv';

import { UnifiedMemoryDB } from '@unified-memory/db';

// Ensure environment is loaded
dotenv.config();

/**
 * Database configuration interface
 */
export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  maxConnections: number;
  vectorDimensions: number;
}

/**
 * Get database configuration from environment variables
 */
export function getDbConfig(): DbConfig {
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20', 10),
    vectorDimensions: parseInt(process.env.VECTOR_DIMENSIONS || '1536', 10),
  };
}

/**
 * Create and initialize a database connection
 */
export async function createDb(): Promise<UnifiedMemoryDB> {
  const db = new UnifiedMemoryDB(getDbConfig());
  await db.initialize();
  return db;
}

/**
 * Run a script with database connection
 * Handles initialization and cleanup automatically
 */
export async function withDb<T>(fn: (db: UnifiedMemoryDB) => Promise<T>): Promise<T> {
  const db = await createDb();
  try {
    return await fn(db);
  } finally {
    await db.close();
  }
}
