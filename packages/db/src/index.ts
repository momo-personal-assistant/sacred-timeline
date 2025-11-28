/**
 * @unified-memory/db
 *
 * Database client package for PostgreSQL with pgvector
 */

export * from './postgres/client';
export * from './postgres/types';

// Singleton pattern for production use
export {
  getDb,
  closeDb,
  createTestDb,
  resetDbSingleton,
  isDbConnected,
  getDbInfo,
} from './singleton';
