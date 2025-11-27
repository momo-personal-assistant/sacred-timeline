import * as fs from 'fs';
import * as path from 'path';

import { UnifiedMemoryDB } from '@unified-memory/db';
import * as dotenv from 'dotenv';
import { NextResponse } from 'next/server';

dotenv.config();

interface ExperimentDoc {
  id: string;
  filename: string;
  title: string;
  date: string;
  status: string;
  decision: string;
  tags: string[];
  content: string;
  metadata: Record<string, unknown>;
  config_file?: string;
  folder_type?: 'completed' | 'plans' | 'rejected' | 'root';
  // Orphan detection
  db_id?: number;
  is_orphan?: boolean;
}

function parseExperimentDoc(
  content: string,
  filename: string,
  folderType: string
): Partial<ExperimentDoc> {
  const metadata: Record<string, unknown> = {};

  // Extract YAML frontmatter from markdown code block
  const yamlMatch = content.match(/```yaml\n([\s\S]*?)\n```/);
  if (yamlMatch) {
    const yamlContent = yamlMatch[1];
    const lines = yamlContent.split('\n');

    for (const line of lines) {
      // Skip comments
      if (line.trim().startsWith('#')) continue;

      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        let value = line.substring(colonIndex + 1).trim();

        // Remove quotes
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }

        // Parse numbers
        if (!isNaN(Number(value)) && value !== '') {
          metadata[key] = Number(value);
        }
        // Parse arrays
        else if (value.startsWith('[') && value.endsWith(']')) {
          try {
            metadata[key] = JSON.parse(value.replace(/'/g, '"'));
          } catch {
            metadata[key] = value;
          }
        }
        // Parse strings
        else {
          metadata[key] = value;
        }
      }
    }
  }

  // Extract title from first H1
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : filename.replace('.md', '');

  return {
    id: (metadata.experiment_id as string) || filename.replace('.md', ''),
    filename,
    title: (metadata.title as string) || title,
    date: (metadata.date as string) || '',
    status: (metadata.status as string) || 'unknown',
    decision: (metadata.decision as string) || 'pending',
    tags: (metadata.tags as string[]) || [],
    content,
    metadata,
    folder_type: folderType as 'completed' | 'plans' | 'rejected' | 'root',
  };
}

export async function GET() {
  try {
    // Path to experiment docs (updated to new structure)
    const docsPath = path.join(process.cwd(), '..', '..', 'docs', 'experiments');

    // Check if directory exists
    if (!fs.existsSync(docsPath)) {
      return NextResponse.json({
        experiments: [],
        orphanDocs: [],
        error: 'Experiments directory not found',
        path: docsPath,
      });
    }

    const experiments: ExperimentDoc[] = [];

    // Read from organized folders
    const folders = ['completed', 'plans', 'rejected'];

    for (const folder of folders) {
      const folderPath = path.join(docsPath, folder);

      if (!fs.existsSync(folderPath)) continue;

      const files = fs
        .readdirSync(folderPath)
        .filter((f) => f.endsWith('.md') && !f.startsWith('_'));

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = parseExperimentDoc(content, file, folder);

        experiments.push({
          id: parsed.id || file,
          filename: file,
          title: parsed.title || file,
          date: parsed.date || '',
          status: parsed.status || 'unknown',
          decision: parsed.decision || 'pending',
          tags: parsed.tags || [],
          content: parsed.content || '',
          metadata: parsed.metadata || {},
          config_file: (parsed.metadata?.config_file as string) || undefined,
          folder_type: parsed.folder_type,
        });
      }
    }

    // Also read from root level (for backward compatibility)
    const rootFiles = fs
      .readdirSync(docsPath)
      .filter((f) => f.endsWith('.md') && !f.startsWith('_'));

    for (const file of rootFiles) {
      const filePath = path.join(docsPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = parseExperimentDoc(content, file, 'root');

      experiments.push({
        id: parsed.id || file,
        filename: file,
        title: parsed.title || file,
        date: parsed.date || '',
        status: parsed.status || 'unknown',
        decision: parsed.decision || 'pending',
        tags: parsed.tags || [],
        content: parsed.content || '',
        metadata: parsed.metadata || {},
        config_file: (parsed.metadata?.config_file as string) || undefined,
        folder_type: 'root',
      });
    }

    // Sort by date descending
    experiments.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });

    // Check which docs have corresponding DB entries
    let dbExperiments: { id: number; name: string }[] = [];
    try {
      const db = new UnifiedMemoryDB({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
        database: process.env.POSTGRES_DB || 'unified_memory',
        user: process.env.POSTGRES_USER || 'unified_memory',
        password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
        maxConnections: 5,
        vectorDimensions: 1536,
      });
      await db.initialize();
      const pool = (db as any).pool;
      const result = await pool.query('SELECT id, name FROM experiments');
      dbExperiments = result.rows;
      await db.close();
    } catch (dbError) {
      console.warn('Could not connect to DB for orphan detection:', dbError);
    }

    // Mark orphan docs (docs without corresponding DB entries)
    const orphanDocs: ExperimentDoc[] = [];
    for (const doc of experiments) {
      const docId = doc.id?.toUpperCase() || '';
      const matchingDbExp = dbExperiments.find((dbExp) => {
        const dbExpId = dbExp.name.split(':')[0]?.trim().toUpperCase() || '';
        return dbExpId === docId || dbExp.name.toUpperCase().includes(docId);
      });

      if (matchingDbExp) {
        doc.db_id = matchingDbExp.id;
        doc.is_orphan = false;
      } else {
        doc.is_orphan = true;
        orphanDocs.push(doc);
      }
    }

    // Group by folder type for stats
    const byFolder = {
      completed: experiments.filter((e) => e.folder_type === 'completed').length,
      plans: experiments.filter((e) => e.folder_type === 'plans').length,
      rejected: experiments.filter((e) => e.folder_type === 'rejected').length,
      root: experiments.filter((e) => e.folder_type === 'root').length,
    };

    return NextResponse.json({
      experiments,
      orphanDocs,
      count: experiments.length,
      orphanCount: orphanDocs.length,
      byFolder,
    });
  } catch (error) {
    console.error('Error reading experiment docs:', error);
    return NextResponse.json(
      {
        error: 'Failed to read experiment docs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
