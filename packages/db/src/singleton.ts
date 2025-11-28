/**
 * Database Singleton Module
 *
 * Provides a single database connection instance for the application.
 * - In production: Validates environment variables and fails fast if missing
 * - In development: Uses default localhost configuration
 * - For tests: Use createTestDb() which creates isolated test instances
 */

import { getDbConfig, getTestDbConfig, isTest, type DbEnv } from '@unified-memory/shared';

import { UnifiedMemoryDB } from './postgres/client';

// Module-level singleton instance
let dbInstance: UnifiedMemoryDB | null = null;
let isInitializing = false;
let initPromise: Promise<UnifiedMemoryDB> | null = null;

/**
 * Get the singleton database instance.
 * Initializes on first call and reuses the same instance.
 *
 * @throws EnvValidationError if required env vars are missing in production
 * @returns Initialized UnifiedMemoryDB instance
 */
export async function getDb(): Promise<UnifiedMemoryDB> {
  // If already initialized, return existing instance
  if (dbInstance) {
    return dbInstance;
  }

  // If initialization is in progress, wait for it
  if (isInitializing && initPromise) {
    return initPromise;
  }

  // Start initialization
  isInitializing = true;
  initPromise = initializeDb();

  try {
    dbInstance = await initPromise;
    return dbInstance;
  } finally {
    isInitializing = false;
    initPromise = null;
  }
}

/**
 * Internal initialization function
 */
async function initializeDb(): Promise<UnifiedMemoryDB> {
  // Get validated config (throws in production if env vars missing)
  const config = isTest() ? getTestDbConfig() : getDbConfig();

  const db = createDbFromConfig(config);
  await db.initialize();

  return db;
}

/**
 * Create a DB instance from validated config
 */
function createDbFromConfig(config: DbEnv): UnifiedMemoryDB {
  return new UnifiedMemoryDB({
    host: config.POSTGRES_HOST,
    port: config.POSTGRES_PORT,
    database: config.POSTGRES_DB,
    user: config.POSTGRES_USER,
    password: config.POSTGRES_PASSWORD,
    maxConnections: config.POSTGRES_MAX_CONNECTIONS,
    vectorDimensions: config.VECTOR_DIMENSIONS,
  });
}

/**
 * Create a new test database instance.
 * Always creates a fresh instance for test isolation.
 *
 * @returns Fresh UnifiedMemoryDB instance for testing
 */
export function createTestDb(): UnifiedMemoryDB {
  const config = getTestDbConfig();
  return createDbFromConfig(config);
}

/**
 * Close the singleton database connection.
 * Call this during application shutdown.
 */
export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Reset the singleton instance.
 * Only use this in tests to reset state between test runs.
 */
export function resetDbSingleton(): void {
  dbInstance = null;
  isInitializing = false;
  initPromise = null;
}

/**
 * Check if database is currently connected
 */
export function isDbConnected(): boolean {
  return dbInstance !== null;
}

/**
 * Get current database configuration (for debugging/logging)
 * Returns sanitized config without password
 */
export function getDbInfo(): {
  host: string;
  port: number;
  database: string;
  user: string;
  isConnected: boolean;
} | null {
  if (!dbInstance) {
    return null;
  }

  const config = isTest() ? getTestDbConfig() : getDbConfig();

  return {
    host: config.POSTGRES_HOST,
    port: config.POSTGRES_PORT,
    database: config.POSTGRES_DB,
    user: config.POSTGRES_USER,
    isConnected: true,
  };
}
