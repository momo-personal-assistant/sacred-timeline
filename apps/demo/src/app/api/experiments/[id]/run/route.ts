import { exec } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';

import { UnifiedMemoryDB } from '@unified-memory/db';
import * as dotenv from 'dotenv';
import { NextRequest, NextResponse } from 'next/server';

dotenv.config();

const execAsync = promisify(exec);

function getDbConfig() {
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

// POST /api/experiments/[id]/run - Run a draft experiment
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const db = new UnifiedMemoryDB(getDbConfig());

  try {
    const experimentId = parseInt(params.id, 10);

    if (isNaN(experimentId)) {
      return NextResponse.json({ error: 'Invalid experiment ID' }, { status: 400 });
    }

    await db.initialize();
    const pool = (db as any).pool;

    // Get the experiment
    const experimentResult = await pool.query('SELECT * FROM experiments WHERE id = $1', [
      experimentId,
    ]);

    if (experimentResult.rows.length === 0) {
      await db.close();
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    const experiment = experimentResult.rows[0];

    // Check if experiment is in draft status
    if (experiment.status !== 'draft') {
      await db.close();
      return NextResponse.json(
        {
          error: `Cannot run experiment with status: ${experiment.status}. Only draft experiments can be run.`,
        },
        { status: 400 }
      );
    }

    // Check if config_file_path exists
    if (!experiment.config_file_path) {
      await db.close();
      return NextResponse.json(
        { error: 'Experiment has no config file path. Cannot run.' },
        { status: 400 }
      );
    }

    // Update status to 'running'
    await pool.query(
      `UPDATE experiments
       SET status = 'running', run_started_at = NOW(), error_message = NULL
       WHERE id = $1`,
      [experimentId]
    );

    // Close db before running experiment to avoid connection issues
    await db.close();

    // Run the experiment in background
    // The experiment script will update the status on completion
    // Note: process.cwd() in Next.js API route returns apps/demo
    // We need to go up 2 levels to reach harare where scripts/ is located
    const projectRoot = path.resolve(process.cwd(), '../..');
    const configPath = experiment.config_file_path;

    // Start the experiment process
    // Note: This runs async - we return immediately and let the script update status
    runExperimentAsync(experimentId, configPath, projectRoot).catch(async (error) => {
      console.error('Experiment failed:', error);
      // Update status to failed
      const db2 = new UnifiedMemoryDB(getDbConfig());
      await db2.initialize();
      const pool2 = (db2 as any).pool;
      await pool2.query(
        `UPDATE experiments
         SET status = 'failed', run_completed_at = NOW(), error_message = $1
         WHERE id = $2`,
        [error.message || String(error), experimentId]
      );
      await db2.close();
    });

    return NextResponse.json({
      success: true,
      message: 'Experiment started',
      experiment_id: experimentId,
      status: 'running',
    });
  } catch (error: any) {
    console.error('Failed to start experiment:', error);
    try {
      await db.close();
    } catch {
      // Ignore close errors
    }
    return NextResponse.json(
      { error: error.message || 'Failed to start experiment' },
      { status: 500 }
    );
  }
}

async function runExperimentAsync(experimentId: number, configPath: string, projectRoot: string) {
  // Run the experiment script
  const command = `cd "${projectRoot}" && pnpm tsx scripts/run-experiment.ts "${configPath}"`;

  console.log(`[Experiment ${experimentId}] Running: ${command}`);

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 10 * 60 * 1000, // 10 minute timeout
      env: { ...process.env },
    });

    console.log(`[Experiment ${experimentId}] stdout:`, stdout);
    if (stderr) {
      console.log(`[Experiment ${experimentId}] stderr:`, stderr);
    }

    // Update the experiment status to completed
    // Note: The script already saves results, we just need to update status
    const db = new UnifiedMemoryDB(getDbConfig());
    await db.initialize();
    const pool = (db as any).pool;

    await pool.query(
      `UPDATE experiments
       SET status = 'completed', run_completed_at = NOW()
       WHERE id = $1`,
      [experimentId]
    );

    await db.close();

    console.log(`[Experiment ${experimentId}] Completed successfully`);
  } catch (error: any) {
    console.error(`[Experiment ${experimentId}] Failed:`, error);
    throw error;
  }
}
