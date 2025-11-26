/**
 * Shared CLI Utilities
 *
 * Common utilities for all CLI scripts in the scripts/ directory.
 *
 * Usage:
 *   import { createDb, withDb, printHeader, parseArgs } from './lib';
 */

// Database utilities
export { createDb, getDbConfig, withDb } from './db';
export type { DbConfig } from './db';

// Console formatting utilities
export {
  formatNumber,
  formatPercent,
  printDivider,
  printDuration,
  printError,
  printHeader,
  printInfo,
  printKV,
  printMetrics,
  printSuccess,
  printWarning,
} from './console';

// Argument parsing utilities
export { getOption, getOptionNumber, getPositional, hasFlag, parseArgs } from './args';
