import type { Memory, CreateMemoryInput } from '@unified-memory/shared';
import { Pool, PoolClient, QueryResult } from 'pg';

import type {
  CanonicalObject,
  CreateCanonicalObjectInput,
  UpdateCanonicalObjectInput,
  CanonicalObjectFilters,
  CanonicalObjectSearchResult,
} from './types';

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
  async searchMemories(_query: string, limit: number = 10): Promise<Memory[]> {
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

    const { threshold = 0.7, limit = 10, platform = null, tags = null } = options;

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
  async getMemoryCount(filters?: { platform?: string; tags?: string[] }): Promise<number> {
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

  // =============================================================================
  // CANONICAL OBJECTS METHODS
  // =============================================================================

  /**
   * Create a canonical object
   */
  async createCanonicalObject(input: CreateCanonicalObjectInput): Promise<CanonicalObject> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const result: QueryResult = await this.pool.query(
      `
      INSERT INTO canonical_objects (
        id,
        platform,
        object_type,
        title,
        body,
        attachments,
        actors,
        timestamps,
        relations,
        properties,
        summary,
        semantic_hash,
        visibility,
        raw
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
      `,
      [
        input.id,
        input.platform,
        input.object_type,
        input.title || null,
        input.body || null,
        input.attachments ? JSON.stringify(input.attachments) : null,
        JSON.stringify(input.actors),
        JSON.stringify(input.timestamps),
        input.relations ? JSON.stringify(input.relations) : null,
        input.properties ? JSON.stringify(input.properties) : null,
        input.summary ? JSON.stringify(input.summary) : null,
        input.semantic_hash || null,
        input.visibility || 'team',
        input.raw ? JSON.stringify(input.raw) : null,
      ]
    );

    return this.mapRowToCanonicalObject(result.rows[0]);
  }

  /**
   * Get a canonical object by ID
   */
  async getCanonicalObject(id: string): Promise<CanonicalObject | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const result: QueryResult = await this.pool.query(
      `
      SELECT * FROM canonical_objects
      WHERE id = $1 AND deleted_at IS NULL
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToCanonicalObject(result.rows[0]);
  }

  /**
   * Update a canonical object
   */
  async updateCanonicalObject(
    id: string,
    updates: UpdateCanonicalObjectInput
  ): Promise<CanonicalObject | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      values.push(updates.title || null);
    }

    if (updates.body !== undefined) {
      setClauses.push(`body = $${paramIndex++}`);
      values.push(updates.body || null);
    }

    if (updates.attachments !== undefined) {
      setClauses.push(`attachments = $${paramIndex++}`);
      values.push(updates.attachments ? JSON.stringify(updates.attachments) : null);
    }

    if (updates.actors !== undefined) {
      setClauses.push(`actors = $${paramIndex++}`);
      values.push(JSON.stringify(updates.actors));
    }

    if (updates.timestamps !== undefined) {
      setClauses.push(`timestamps = $${paramIndex++}`);
      values.push(JSON.stringify(updates.timestamps));
    }

    if (updates.relations !== undefined) {
      setClauses.push(`relations = $${paramIndex++}`);
      values.push(updates.relations ? JSON.stringify(updates.relations) : null);
    }

    if (updates.properties !== undefined) {
      setClauses.push(`properties = $${paramIndex++}`);
      values.push(updates.properties ? JSON.stringify(updates.properties) : null);
    }

    if (updates.summary !== undefined) {
      setClauses.push(`summary = $${paramIndex++}`);
      values.push(updates.summary ? JSON.stringify(updates.summary) : null);
    }

    if (updates.semantic_hash !== undefined) {
      setClauses.push(`semantic_hash = $${paramIndex++}`);
      values.push(updates.semantic_hash || null);
    }

    if (updates.visibility !== undefined) {
      setClauses.push(`visibility = $${paramIndex++}`);
      values.push(updates.visibility);
    }

    if (updates.raw !== undefined) {
      setClauses.push(`raw = $${paramIndex++}`);
      values.push(updates.raw ? JSON.stringify(updates.raw) : null);
    }

    if (setClauses.length === 0) {
      return this.getCanonicalObject(id);
    }

    values.push(id);

    const result: QueryResult = await this.pool.query(
      `
      UPDATE canonical_objects
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToCanonicalObject(result.rows[0]);
  }

  /**
   * Soft delete a canonical object
   */
  async deleteCanonicalObject(id: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const result: QueryResult = await this.pool.query(
      `
      UPDATE canonical_objects
      SET deleted_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      `,
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Search canonical objects with filters
   */
  async searchCanonicalObjects(
    filters: CanonicalObjectFilters = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<CanonicalObject[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Always exclude deleted by default
    if (!filters.include_deleted) {
      conditions.push('deleted_at IS NULL');
    }

    // Platform filter
    if (filters.platform) {
      if (Array.isArray(filters.platform)) {
        conditions.push(`platform = ANY($${paramIndex++})`);
        values.push(filters.platform);
      } else {
        conditions.push(`platform = $${paramIndex++}`);
        values.push(filters.platform);
      }
    }

    // Object type filter
    if (filters.object_type) {
      if (Array.isArray(filters.object_type)) {
        conditions.push(`object_type = ANY($${paramIndex++})`);
        values.push(filters.object_type);
      } else {
        conditions.push(`object_type = $${paramIndex++}`);
        values.push(filters.object_type);
      }
    }

    // Visibility filter
    if (filters.visibility) {
      conditions.push(`visibility = $${paramIndex++}`);
      values.push(filters.visibility);
    }

    // Date filters
    if (filters.created_after) {
      conditions.push(`(timestamps->>'created_at')::timestamptz >= $${paramIndex++}`);
      values.push(filters.created_after);
    }

    if (filters.created_before) {
      conditions.push(`(timestamps->>'created_at')::timestamptz <= $${paramIndex++}`);
      values.push(filters.created_before);
    }

    if (filters.updated_after) {
      conditions.push(`(timestamps->>'updated_at')::timestamptz >= $${paramIndex++}`);
      values.push(filters.updated_after);
    }

    if (filters.updated_before) {
      conditions.push(`(timestamps->>'updated_at')::timestamptz <= $${paramIndex++}`);
      values.push(filters.updated_before);
    }

    // Actor filters
    if (filters.created_by) {
      conditions.push(`actors @> $${paramIndex++}::jsonb`);
      values.push(JSON.stringify({ created_by: filters.created_by }));
    }

    if (filters.participant) {
      conditions.push(`actors->'participants' @> $${paramIndex++}::jsonb`);
      values.push(JSON.stringify([filters.participant]));
    }

    // Property filters
    if (filters.has_label) {
      conditions.push(`properties->'labels' @> $${paramIndex++}::jsonb`);
      values.push(JSON.stringify([filters.has_label]));
    }

    if (filters.status) {
      conditions.push(`properties @> $${paramIndex++}::jsonb`);
      values.push(JSON.stringify({ status: filters.status }));
    }

    // Full-text search
    if (filters.search_query) {
      conditions.push(
        `to_tsvector('english', COALESCE(search_text, '')) @@ plainto_tsquery('english', $${paramIndex++})`
      );
      values.push(filters.search_query);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    values.push(limit, offset);

    const query = `
      SELECT * FROM canonical_objects
      ${whereClause}
      ORDER BY (timestamps->>'created_at')::timestamptz DESC
      LIMIT $${paramIndex++}
      OFFSET $${paramIndex++}
    `;

    const result: QueryResult = await this.pool.query(query, values);

    return result.rows.map((row) => this.mapRowToCanonicalObject(row));
  }

  /**
   * Full-text search with ranking
   */
  async searchCanonicalObjectsByText(
    query: string,
    limit: number = 20
  ): Promise<CanonicalObjectSearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const result: QueryResult = await this.pool.query(
      `
      SELECT
        *,
        ts_rank(
          to_tsvector('english', COALESCE(search_text, '')),
          plainto_tsquery('english', $1)
        ) AS search_rank
      FROM canonical_objects
      WHERE
        deleted_at IS NULL
        AND to_tsvector('english', COALESCE(search_text, '')) @@ plainto_tsquery('english', $1)
      ORDER BY search_rank DESC
      LIMIT $2
      `,
      [query, limit]
    );

    return result.rows.map((row) => ({
      ...this.mapRowToCanonicalObject(row),
      search_rank: parseFloat(row.search_rank),
    }));
  }

  /**
   * Get canonical objects count
   */
  async getCanonicalObjectCount(filters: CanonicalObjectFilters = {}): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (!filters.include_deleted) {
      conditions.push('deleted_at IS NULL');
    }

    if (filters.platform) {
      if (Array.isArray(filters.platform)) {
        conditions.push(`platform = ANY($${paramIndex++})`);
        values.push(filters.platform);
      } else {
        conditions.push(`platform = $${paramIndex++}`);
        values.push(filters.platform);
      }
    }

    if (filters.object_type) {
      if (Array.isArray(filters.object_type)) {
        conditions.push(`object_type = ANY($${paramIndex++})`);
        values.push(filters.object_type);
      } else {
        conditions.push(`object_type = $${paramIndex++}`);
        values.push(filters.object_type);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result: QueryResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM canonical_objects ${whereClause}`,
      values
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Helper method to map database row to CanonicalObject type
   */
  private mapRowToCanonicalObject(row: any): CanonicalObject {
    return {
      id: row.id,
      platform: row.platform,
      object_type: row.object_type,
      title: row.title,
      body: row.body,
      attachments: row.attachments,
      actors: row.actors,
      timestamps: row.timestamps,
      relations: row.relations,
      properties: row.properties,
      summary: row.summary,
      search_text: row.search_text,
      semantic_hash: row.semantic_hash,
      visibility: row.visibility,
      deleted_at: row.deleted_at,
      indexed_at: row.indexed_at,
      raw: row.raw,
    };
  }
}
