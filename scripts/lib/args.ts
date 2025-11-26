/**
 * Command Line Argument Utilities
 *
 * Simple helpers for parsing CLI arguments.
 * For complex CLI needs, consider using yargs or commander.
 */

/**
 * Parse command line arguments into a structured object
 * Supports: --flag, --key=value, --key value, positional args
 */
export function parseArgs(argv: string[] = process.argv.slice(2)): {
  flags: Set<string>;
  options: Map<string, string>;
  positional: string[];
} {
  const flags = new Set<string>();
  const options = new Map<string, string>();
  const positional: string[] = [];

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg.startsWith('--')) {
      if (arg.includes('=')) {
        // --key=value format
        const [key, value] = arg.slice(2).split('=');
        options.set(key, value);
      } else {
        // Check if next arg is a value or another flag
        const key = arg.slice(2);
        const nextArg = argv[i + 1];

        if (nextArg && !nextArg.startsWith('-')) {
          // --key value format
          options.set(key, nextArg);
          i++;
        } else {
          // --flag format (boolean)
          flags.add(key);
        }
      }
    } else if (arg.startsWith('-')) {
      // Short flags: -v, -abc (treated as flags)
      const shortFlags = arg.slice(1).split('');
      shortFlags.forEach((f) => flags.add(f));
    } else {
      // Positional argument
      positional.push(arg);
    }

    i++;
  }

  return { flags, options, positional };
}

/**
 * Check if a flag is present
 */
export function hasFlag(args: ReturnType<typeof parseArgs>, flag: string): boolean {
  return args.flags.has(flag);
}

/**
 * Get option value with default
 */
export function getOption(
  args: ReturnType<typeof parseArgs>,
  key: string,
  defaultValue: string
): string {
  return args.options.get(key) ?? defaultValue;
}

/**
 * Get option value as number with default
 */
export function getOptionNumber(
  args: ReturnType<typeof parseArgs>,
  key: string,
  defaultValue: number
): number {
  const value = args.options.get(key);
  return value ? parseInt(value, 10) : defaultValue;
}

/**
 * Get first positional argument with default
 */
export function getPositional(
  args: ReturnType<typeof parseArgs>,
  index: number,
  defaultValue: string
): string {
  return args.positional[index] ?? defaultValue;
}
