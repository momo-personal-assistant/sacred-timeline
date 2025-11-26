/**
 * Pipeline Stage Benchmarks
 *
 * Benchmarking tools for measuring and comparing pipeline performance.
 *
 * Usage:
 *   pnpm tsx scripts/benchmark/benchmark-chunking.ts
 *   pnpm tsx scripts/benchmark/benchmark-embedding.ts
 *   pnpm tsx scripts/benchmark/benchmark-relation-inference.ts
 *
 * Options:
 *   --save      Save results to data/benchmarks/
 *   --compare   Compare with previous baseline
 *
 * Results are saved as JSON files in data/benchmarks/ directory.
 */

export * from './types';
export * from './utils';
