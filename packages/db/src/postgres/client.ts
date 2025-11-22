import { Pool, PoolClient, QueryResult } from 'pg';
import type { Memory, CreateMemoryInput } from '@unified-memory/shared';

/**
 * PostgreSQL Client Wrapper with pgvector
 *
 * Purpose: Provide a clean, type-safe interface to PostgreSQL with pgvector extension.
 * This abstraction:
 * - Manages connection pooling lifecycle
 * - Provides typed CRUD operations for memories
 * - Handles vector similarity search with pgvector
 * - Implements error handling and retries
 * - Maintains the same interface as the previous Qdrant client for easy migration
 */

interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  maxConnections?: number;
  vectorDimensions: number;
}

export class UnifiedMemoryDB {
  private pool: Pool;
  private config: PostgresConfig;
  private isInitialized = false;

  constructor(config: PostgresConfig) {
    this.config = config;
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.maxConnections || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Error handling for pool
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
  }

  /**
   * Initialize the database connection and ensure schema exists
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    let client: PoolClient | null = null;

    try {
      client = await this.pool.connect();

      // Check if pgvector extension is installed
      const extensionCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_extension WHERE extname = 'vector'
        ) AS has_pgvector;
      `);

      if (!extensionCheck.rows[0].has_pgvector) {
        throw new Error(
          'pgvector extension is not installed. Please run migrations or install manually.'
        );
      }

      // Check if memories table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'memories'
        ) AS table_exists;
      `);

      if (!tableCheck.rows[0].table_exists) {
        console.warn(
          '⚠️  memories table does not exist. Please run migrations: db/migrations/001_init_pgvector.sql'
        );
      }

      this.isInitialized = true;
      console.log(`✅ Connected to PostgreSQL at ${this.config.host}:${this.config.port}`);
    } catch (error) {
      console.error('❌ Failed to initialize PostgreSQL:', error);
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Health check - verify PostgreSQL is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1');
      return result.rowCount === 1;
    } catch {
      return false;
    }
  }

  /**
   * Store a memory in PostgreSQL
   * TODO: Implement embeddings generation
   */
  async createMemory(input: CreateMemoryInput): Promise<Memory> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // TODO: Generate embeddings for content
    // This requires an embeddings model (OpenAI, Cohere, local model, etc.)
    const embeddings = new Array(this.config.vectorDimensions).fill(0); // Placeholder

    const memory: Memory = {
      id: crypto.randomUUID(),
      content: input.content,
      embeddings,
      metadata: input.metadata || {},
      tags: input.tags || [],
      platform: input.platform,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Convert embeddings array to pgvector format string: '[0.1, 0.2, ...]'
    const embeddingVector = `[${embeddings.join(',')}]`;

    await this.pool.query(
      `
      INSERT INTO memories (id, embedding, content, metadata, tags, platform, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        memory.id,
        embeddingVector,
        memory.content,
        JSON.stringify(memory.metadata),
        memory.tags,
        memory.platform,
        memory.createdAt,
        memory.updatedAt,
      ]
    );

    return memory;
  }

  /**
   * Search memories by vector similarity
   * TODO: Implement proper embeddings-based search
   */
  async searchMemories(query: string, limit: number = 10): Promise<Memory[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // TODO: Generate embeddings for query
    const queryEmbeddings = new Array(this.config.vectorDimensions).fill(0); // Placeholder
    const embeddingVector = `[${queryEmbeddings.join(',')}]`;

    const result: QueryResult = await this.pool.query(
      `
      SELECT
        id,
        content,
        metadata,
        tags,
        platform,
        created_at,
        updated_at,
        1 - (embedding <=> $1::vector) AS similarity
      FROM memories
      ORDER BY embedding <=> $1::vector
      LIMIT $2
      `,
      [embeddingVector, limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      content: row.content,
      embeddings: queryEmbeddings,
      metadata: row.metadata,
      tags: row.tags,
      platform: row.platform,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Search memories with advanced filtering
   * Uses the search_memories() PostgreSQL function created in migrations
   */
  async searchMemoriesWithFilter(
    queryEmbeddings: number[],
    options: {
      threshold?: number;
      limit?: number;
      platform?: string;
      tags?: string[];
    } = {}
  ): Promise<Memory[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const {
      threshold = 0.7,
      limit = 10,
      platform = null,
      tags = null,
    } = options;

    const embeddingVector = `[${queryEmbeddings.join(',')}]`;

    const result: QueryResult = await this.pool.query(
      `
      SELECT * FROM search_memories(
        $1::vector,
        $2::float,
        $3::int,
        $4::varchar,
        $5::text[]
      )
      `,
      [embeddingVector, threshold, limit, platform, tags]
    );

    return result.rows.map((row) => ({
      id: row.id,
      content: row.content,
      embeddings: queryEmbeddings,
      metadata: row.metadata,
      tags: row.tags,
      platform: row.platform,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Get a specific memory by ID
   */
  async getMemory(id: string): Promise<Memory | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const result: QueryResult = await this.pool.query(
      `
      SELECT
        id,
        embedding,
        content,
        metadata,
        tags,
        platform,
        created_at,
        updated_at
      FROM memories
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // Parse embedding string back to number array
    // pgvector returns embeddings as a string like '[0.1,0.2,...]'
    const embeddingStr = row.embedding;
    const embeddings = embeddingStr
      .slice(1, -1)
      .split(',')
      .map((v: string) => parseFloat(v));

    return {
      id: row.id,
      content: row.content,
      embeddings,
      metadata: row.metadata,
      tags: row.tags,
      platform: row.platform,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Update a memory
   */
  async updateMemory(
    id: string,
    updates: Partial<Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Memory | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.content !== undefined) {
      setClauses.push(`content = $${paramIndex++}`);
      values.push(updates.content);
    }

    if (updates.embeddings !== undefined) {
      setClauses.push(`embedding = $${paramIndex++}`);
      values.push(`[${updates.embeddings.join(',')}]`);
    }

    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    if (updates.tags !== undefined) {
      setClauses.push(`tags = $${paramIndex++}`);
      values.push(updates.tags);
    }

    if (updates.platform !== undefined) {
      setClauses.push(`platform = $${paramIndex++}`);
      values.push(updates.platform);
    }

    if (setClauses.length === 0) {
      return this.getMemory(id);
    }

    // updated_at is automatically updated by trigger
    values.push(id);

    const result: QueryResult = await this.pool.query(
      `
      UPDATE memories
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const embeddingStr = row.embedding;
    const embeddings = embeddingStr
      .slice(1, -1)
      .split(',')
      .map((v: string) => parseFloat(v));

    return {
      id: row.id,
      content: row.content,
      embeddings,
      metadata: row.metadata,
      tags: row.tags,
      platform: row.platform,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Delete a memory
   */
  async deleteMemory(id: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const result: QueryResult = await this.pool.query(
      `
      DELETE FROM memories
      WHERE id = $1
      `,
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get memory count
   */
  async getMemoryCount(filters?: {
    platform?: string;
    tags?: string[];
  }): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    let query = 'SELECT COUNT(*) as count FROM memories';
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.platform) {
      conditions.push(`platform = $${paramIndex++}`);
      values.push(filters.platform);
    }

    if (filters?.tags && filters.tags.length > 0) {
      conditions.push(`tags && $${paramIndex++}`);
      values.push(filters.tags);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const result: QueryResult = await this.pool.query(query, values);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
    this.isInitialized = false;
    console.log('✅ PostgreSQL connection pool closed');
  }
}
