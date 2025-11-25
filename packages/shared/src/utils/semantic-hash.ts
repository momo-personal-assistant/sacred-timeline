/**
 * Semantic Hash Utility
 *
 * Generates consistent hashes for canonical objects to enable:
 * 1. Fast duplicate detection (exact match)
 * 2. Near-duplicate detection (similar content)
 *
 * Based on CDM paper recommendation for deduplication
 */

import { createHash } from 'crypto';

/**
 * Normalize text for consistent hashing
 * - Lowercase
 * - Remove extra whitespace
 * - Sort words (order-independent matching)
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim()
    .split(' ')
    .filter((word) => word.length > 2) // Remove very short words
    .sort() // Sort for order-independent matching
    .join(' ');
}

/**
 * Generate SHA256 hash of normalized text
 */
export function generateHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').substring(0, 64);
}

/**
 * Generate semantic hash for a canonical object
 *
 * Combines title + body + keywords into a normalized, hashed value
 * Objects with the same semantic_hash are likely duplicates
 */
export function generateSemanticHash(params: {
  title?: string;
  body?: string;
  keywords?: string[];
}): string {
  const parts: string[] = [];

  if (params.title) {
    parts.push(normalizeText(params.title));
  }

  if (params.body) {
    // For body, only use first 500 chars to avoid over-weighting long content
    parts.push(normalizeText(params.body.substring(0, 500)));
  }

  if (params.keywords && params.keywords.length > 0) {
    parts.push(
      params.keywords
        .map((k) => k.toLowerCase())
        .sort()
        .join(' ')
    );
  }

  const combined = parts.join(' | ');
  return generateHash(combined);
}

/**
 * Generate a lightweight fingerprint for quick comparison
 * Uses only title and keywords (faster than full semantic hash)
 */
export function generateFingerprint(params: { title?: string; keywords?: string[] }): string {
  const parts: string[] = [];

  if (params.title) {
    // Extract key terms from title (first 5 significant words)
    const titleTerms = normalizeText(params.title).split(' ').slice(0, 5);
    parts.push(titleTerms.join(' '));
  }

  if (params.keywords && params.keywords.length > 0) {
    parts.push(
      params.keywords
        .map((k) => k.toLowerCase())
        .sort()
        .join(' ')
    );
  }

  const combined = parts.join(' | ');
  return generateHash(combined).substring(0, 16); // Shorter hash for fingerprint
}

/**
 * Check if two semantic hashes match (exact duplicate)
 */
export function isExactDuplicate(hash1: string, hash2: string): boolean {
  return hash1 === hash2;
}

/**
 * Calculate similarity between two fingerprints using character overlap
 * Returns a value between 0 and 1
 */
export function fingerprintSimilarity(fp1: string, fp2: string): number {
  if (fp1 === fp2) return 1.0;

  // Compare character-by-character
  let matches = 0;
  const len = Math.min(fp1.length, fp2.length);

  for (let i = 0; i < len; i++) {
    if (fp1[i] === fp2[i]) {
      matches++;
    }
  }

  return matches / Math.max(fp1.length, fp2.length);
}
