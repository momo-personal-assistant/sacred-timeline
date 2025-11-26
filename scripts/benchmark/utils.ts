/**
 * Benchmark Utilities
 *
 * Common utilities for running and reporting benchmarks
 */

import * as fs from 'fs';
import * as path from 'path';

import type { BenchmarkResult, ComparisonResult } from './types';

/**
 * Timer utility for measuring execution time
 */
export class Timer {
  private startTime: number = 0;
  private endTime: number = 0;

  start(): void {
    this.startTime = performance.now();
  }

  stop(): number {
    this.endTime = performance.now();
    return this.duration();
  }

  duration(): number {
    return Math.round(this.endTime - this.startTime);
  }
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Format percentage with sign
 */
export function formatPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

/**
 * Calculate percentage difference
 */
export function pctDiff(baseline: number, experiment: number): number {
  if (baseline === 0) return 0;
  return ((experiment - baseline) / baseline) * 100;
}

/**
 * Compare two benchmark results
 */
export function compareBenchmarks(
  baseline: BenchmarkResult,
  experiment: BenchmarkResult
): ComparisonResult {
  const durationDiff = experiment.metrics.duration_ms - baseline.metrics.duration_ms;
  const durationPct = pctDiff(baseline.metrics.duration_ms, experiment.metrics.duration_ms);

  let throughputPct: number | undefined;
  if (baseline.metrics.throughput && experiment.metrics.throughput) {
    throughputPct = pctDiff(baseline.metrics.throughput, experiment.metrics.throughput);
  }

  let costPct: number | undefined;
  if (baseline.metrics.cost_usd && experiment.metrics.cost_usd) {
    costPct = pctDiff(baseline.metrics.cost_usd, experiment.metrics.cost_usd);
  }

  // Determine winner (lower duration is better, higher throughput is better)
  let winner: 'baseline' | 'experiment' | 'tie' = 'tie';
  if (Math.abs(durationPct) > 5) {
    winner = durationPct < 0 ? 'experiment' : 'baseline';
  }

  return {
    baseline,
    experiment,
    diff: {
      duration_ms: durationDiff,
      duration_pct: durationPct,
      throughput_pct: throughputPct,
      cost_pct: costPct,
    },
    winner,
  };
}

/**
 * Print benchmark result to console
 */
export function printResult(result: BenchmarkResult): void {
  console.log('\n' + '═'.repeat(60));
  console.log(`📊 Benchmark: ${result.config.name}`);
  console.log('═'.repeat(60));
  console.log(`Stage: ${result.stage}`);
  console.log(`Description: ${result.config.description}`);
  console.log(`Timestamp: ${result.timestamp}`);
  console.log('\nMetrics:');
  console.log(`  Duration: ${formatDuration(result.metrics.duration_ms)}`);
  if (result.metrics.throughput) {
    console.log(`  Throughput: ${result.metrics.throughput.toFixed(2)} items/sec`);
  }
  if (result.metrics.cost_usd) {
    console.log(`  Cost: $${result.metrics.cost_usd.toFixed(4)}`);
  }
  console.log('\nDetails:');
  for (const [key, value] of Object.entries(result.details)) {
    console.log(`  ${key}: ${typeof value === 'number' ? value.toLocaleString() : value}`);
  }
}

/**
 * Print comparison result to console
 */
export function printComparison(comparison: ComparisonResult): void {
  console.log('\n' + '═'.repeat(60));
  console.log('📈 Benchmark Comparison');
  console.log('═'.repeat(60));
  console.log(`Baseline: ${comparison.baseline.config.name}`);
  console.log(`Experiment: ${comparison.experiment.config.name}`);
  console.log('\nResults:');
  console.log(
    `  Duration: ${formatDuration(comparison.baseline.metrics.duration_ms)} → ${formatDuration(comparison.experiment.metrics.duration_ms)} (${formatPct(comparison.diff.duration_pct)})`
  );
  if (comparison.diff.throughput_pct !== undefined) {
    console.log(`  Throughput: ${formatPct(comparison.diff.throughput_pct)}`);
  }
  if (comparison.diff.cost_pct !== undefined) {
    console.log(`  Cost: ${formatPct(comparison.diff.cost_pct)}`);
  }
  console.log(
    `\nWinner: ${comparison.winner === 'tie' ? '🤝 Tie' : comparison.winner === 'experiment' ? '🏆 Experiment' : '🏆 Baseline'}`
  );
}

/**
 * Save benchmark result to JSON file
 */
export function saveResult(result: BenchmarkResult, outputDir?: string): string {
  const dir = outputDir || path.join(process.cwd(), 'data', 'benchmarks');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filename = `${result.stage}-${Date.now()}.json`;
  const filepath = path.join(dir, filename);

  fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
  return filepath;
}

/**
 * Load benchmark result from JSON file
 */
export function loadResult(filepath: string): BenchmarkResult {
  const content = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(content) as BenchmarkResult;
}

/**
 * Get latest benchmark result for a stage
 */
export function getLatestResult(stage: string, outputDir?: string): BenchmarkResult | null {
  const dir = outputDir || path.join(process.cwd(), 'data', 'benchmarks');
  if (!fs.existsSync(dir)) return null;

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${stage}-`) && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  return loadResult(path.join(dir, files[0]));
}

/**
 * Memory usage helper
 */
export function getMemoryUsage(): number {
  const usage = process.memoryUsage();
  return Math.round(usage.heapUsed / 1024 / 1024);
}
