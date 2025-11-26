/**
 * Console Formatting Utilities
 *
 * Shared console output formatting for all CLI scripts.
 * Provides consistent visual styling across scripts.
 */

/**
 * Print a boxed header
 */
export function printHeader(title: string): void {
  const width = 60;
  const padding = Math.max(0, width - title.length - 2);
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;

  console.log('╔' + '═'.repeat(width) + '╗');
  console.log('║' + ' '.repeat(leftPad) + title + ' '.repeat(rightPad) + '║');
  console.log('╚' + '═'.repeat(width) + '╝');
  console.log();
}

/**
 * Print a section divider
 */
export function printDivider(label?: string): void {
  if (label) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`${label.toUpperCase()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } else {
    console.log('────────────────────────────────────────────────────────────');
  }
}

/**
 * Print success message
 */
export function printSuccess(message: string): void {
  console.log(`✅ ${message}`);
}

/**
 * Print error message
 */
export function printError(message: string): void {
  console.error(`❌ ${message}`);
}

/**
 * Print warning message
 */
export function printWarning(message: string): void {
  console.warn(`⚠️  ${message}`);
}

/**
 * Print info message
 */
export function printInfo(message: string): void {
  console.log(`ℹ️  ${message}`);
}

/**
 * Print a key-value pair with consistent formatting
 */
export function printKV(key: string, value: string | number, indent: number = 3): void {
  console.log(' '.repeat(indent) + `${key}: ${value}`);
}

/**
 * Print metrics in a formatted way
 */
export function printMetrics(metrics: {
  f1_score?: number;
  precision?: number;
  recall?: number;
  [key: string]: number | undefined;
}): void {
  console.log('📊 Metrics:');
  if (metrics.f1_score !== undefined) {
    printKV('F1 Score', `${(metrics.f1_score * 100).toFixed(1)}%`);
  }
  if (metrics.precision !== undefined) {
    printKV('Precision', `${(metrics.precision * 100).toFixed(1)}%`);
  }
  if (metrics.recall !== undefined) {
    printKV('Recall', `${(metrics.recall * 100).toFixed(1)}%`);
  }
}

/**
 * Print duration in human-readable format
 */
export function printDuration(label: string, durationMs: number): void {
  if (durationMs < 1000) {
    console.log(`⏱️  ${label}: ${durationMs}ms`);
  } else {
    console.log(`⏱️  ${label}: ${(durationMs / 1000).toFixed(1)}s`);
  }
}

/**
 * Format a percentage
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format a number with commas
 */
export function formatNumber(value: number): string {
  return value.toLocaleString();
}
