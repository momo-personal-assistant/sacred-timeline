import * as fs from 'fs/promises';
import * as path from 'path';

import { NextResponse } from 'next/server';

// Path to experiments directory
const EXPERIMENTS_DIR = path.resolve(process.cwd(), '../..', 'data/experiments');
const RESULTS_FILE = path.resolve(process.cwd(), '../..', 'data/benchmark-results.json');

export interface ExperimentDoc {
  id: string;
  name: string;
  description: string;
  created_at: string;
  status: string;
  baseline?: string;
  config: {
    retrieval: {
      similarity_threshold: number;
      chunk_limit: number;
    };
    embedding: {
      model: string;
      dimensions: number;
    };
    changes: Array<{
      file: string;
      description: string;
      rationale: string;
      lines?: string;
    }>;
  };
  results: {
    overall_accuracy: number;
    accuracy_by_type: Record<string, number>;
    passed_queries: string[];
    failed_queries: string[];
    latency: {
      avg_ms: number;
      p50_ms: number;
      p95_ms: number;
    };
  };
  comparison?: {
    baseline_accuracy: number;
    new_accuracy: number;
    improvement: string;
    improvement_factor: string;
    newly_passed: string[];
    newly_failed: string[];
    latency_change: string;
  };
  analysis: {
    key_findings: string[];
    bottlenecks?: string[];
    remaining_issues?: string[];
    is_overfitting?: boolean;
    overfitting_rationale?: string;
  };
}

// GET /api/benchmark - Get all experiments and latest results
export async function GET() {
  try {
    // Read all experiment files
    const experiments: ExperimentDoc[] = [];

    try {
      const files = await fs.readdir(EXPERIMENTS_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(EXPERIMENTS_DIR, file);
          const content = await fs.readFile(filePath, 'utf-8');
          experiments.push(JSON.parse(content));
        }
      }
    } catch (err) {
      // Directory doesn't exist yet
      console.warn('Experiments directory not found:', err);
    }

    // Sort by created_at descending (newest first)
    experiments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Read latest benchmark results
    let latestResults = null;
    try {
      const resultsRaw = await fs.readFile(RESULTS_FILE, 'utf-8');
      latestResults = JSON.parse(resultsRaw);
    } catch (err) {
      console.warn('Benchmark results not found:', err);
    }

    // Find best experiment
    const bestExperiment = experiments.reduce(
      (best, exp) => {
        if (!best || exp.results.overall_accuracy > best.results.overall_accuracy) {
          return exp;
        }
        return best;
      },
      null as ExperimentDoc | null
    );

    return NextResponse.json({
      success: true,
      data: {
        experiments,
        latestResults,
        summary: {
          total_experiments: experiments.length,
          best_experiment: bestExperiment
            ? {
                id: bestExperiment.id,
                name: bestExperiment.name,
                accuracy: bestExperiment.results.overall_accuracy,
              }
            : null,
          latest_accuracy: latestResults?.metrics?.overall_accuracy ?? null,
        },
      },
    });
  } catch (error: any) {
    console.error('Failed to read benchmark data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read benchmark data' },
      { status: 500 }
    );
  }
}
