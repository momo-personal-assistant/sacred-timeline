import { UnifiedMemoryDB } from '@unified-memory/db';

async function checkIssueStatus() {
  const db = new UnifiedMemoryDB({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    vectorDimensions: parseInt(process.env.VECTOR_DIMENSIONS || '1536', 10),
  });

  try {
    await db.initialize();

    const pool = (
      db as unknown as { pool: { query: (sql: string) => Promise<{ rows: unknown[] }> } }
    ).pool;

    const issueIds = [
      'TEN-159',
      'TEN-160',
      'TEN-162',
      'TEN-164',
      'TEN-165',
      'TEN-168',
      'TEN-171',
      'TEN-156',
    ];

    console.log('Checking status of feedback-linked issues:\n');

    for (const issueId of issueIds) {
      const result = await pool.query(
        `SELECT id, title, properties->>'status' as status FROM canonical_objects WHERE id LIKE $1`,
        [`%${issueId}%`]
      );

      if (result.rows.length > 0) {
        const issue = result.rows[0] as any;
        console.log(`${issueId}: ${issue.status} - "${issue.title.substring(0, 60)}..."`);
      } else {
        console.log(`${issueId}: NOT FOUND in database`);
      }
    }

    await db.close();
  } catch (error) {
    console.error('Error:', error);
    await db.close();
  }
}

checkIssueStatus();
