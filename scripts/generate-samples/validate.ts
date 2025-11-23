#!/usr/bin/env node
/**
 * Validation script for generated sample data
 *
 * Checks that generated samples conform to expected schemas and constraints
 *
 * Usage:
 *   npm run validate:samples
 */

import fs from 'fs/promises';
import path from 'path';

import type { LinearIssue } from './linear';
import type { WorstCase } from './worst-cases';
import type { ZendeskTicket } from './zendesk';

// =============================================================================
// Validation Results
// =============================================================================

interface ValidationError {
  file: string;
  index?: number;
  field?: string;
  error: string;
}

interface ValidationResult {
  file: string;
  passed: boolean;
  itemCount: number;
  errors: ValidationError[];
}

class Validator {
  private results: ValidationResult[] = [];

  addResult(result: ValidationResult): void {
    this.results.push(result);
  }

  printSummary(): void {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                   Validation Summary                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    let totalErrors = 0;
    for (const result of this.results) {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.file}: ${result.itemCount} items`);

      if (result.errors.length > 0) {
        totalErrors += result.errors.length;
        result.errors.forEach((error) => {
          const location = error.index !== undefined ? `[${error.index}]` : '';
          const field = error.field ? `.${error.field}` : '';
          console.log(`   ⚠️  ${location}${field}: ${error.error}`);
        });
      }
    }

    console.log('');
    if (totalErrors === 0) {
      console.log('✨ All validations passed!\n');
    } else {
      console.log(`⚠️  Found ${totalErrors} validation errors\n`);
      process.exit(1);
    }
  }
}

// =============================================================================
// Linear Validation
// =============================================================================

function validateLinearIssue(issue: LinearIssue, index: number): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (!issue.id) {
    errors.push({ file: 'linear.json', index, field: 'id', error: 'Missing id' });
  }
  if (!issue.identifier) {
    errors.push({ file: 'linear.json', index, field: 'identifier', error: 'Missing identifier' });
  }
  if (!issue.title) {
    errors.push({ file: 'linear.json', index, field: 'title', error: 'Missing title' });
  }

  // Identifier format: TEAM-NNN
  if (issue.identifier && !/^[A-Z]+-\d+$/.test(issue.identifier)) {
    errors.push({
      file: 'linear.json',
      index,
      field: 'identifier',
      error: `Invalid identifier format: ${issue.identifier}`,
    });
  }

  // Priority range: 0-4
  if (issue.priority < 0 || issue.priority > 4) {
    errors.push({
      file: 'linear.json',
      index,
      field: 'priority',
      error: `Priority out of range: ${issue.priority}`,
    });
  }

  // State
  if (!issue.state || !issue.state.id || !issue.state.name) {
    errors.push({ file: 'linear.json', index, field: 'state', error: 'Invalid state' });
  }

  // Creator
  if (!issue.creator || !issue.creator.id) {
    errors.push({ file: 'linear.json', index, field: 'creator', error: 'Missing creator' });
  }

  // Comments structure
  if (!issue.comments || !Array.isArray(issue.comments.nodes)) {
    errors.push({
      file: 'linear.json',
      index,
      field: 'comments',
      error: 'Invalid comments structure',
    });
  } else {
    // Validate comment IDs are unique
    const commentIds = new Set<string>();
    issue.comments.nodes.forEach((comment, cIdx) => {
      if (commentIds.has(comment.id)) {
        errors.push({
          file: 'linear.json',
          index,
          field: `comments[${cIdx}].id`,
          error: `Duplicate comment ID: ${comment.id}`,
        });
      }
      commentIds.add(comment.id);

      // Validate parent reference exists
      if (comment.parent) {
        const parentExists = issue.comments.nodes.some((c) => c.id === comment.parent);
        if (!parentExists) {
          errors.push({
            file: 'linear.json',
            index,
            field: `comments[${cIdx}].parent`,
            error: `Parent comment not found: ${comment.parent}`,
          });
        }
      }
    });
  }

  // Timestamps
  if (!issue.createdAt || isNaN(Date.parse(issue.createdAt))) {
    errors.push({ file: 'linear.json', index, field: 'createdAt', error: 'Invalid createdAt' });
  }
  if (!issue.updatedAt || isNaN(Date.parse(issue.updatedAt))) {
    errors.push({ file: 'linear.json', index, field: 'updatedAt', error: 'Invalid updatedAt' });
  }

  // URL format
  if (!issue.url || !issue.url.startsWith('https://linear.app/')) {
    errors.push({ file: 'linear.json', index, field: 'url', error: 'Invalid URL format' });
  }

  return errors;
}

async function validateLinearSamples(filePath: string, validator: Validator): Promise<void> {
  console.log('\n🔷 Validating Linear samples...');

  const content = await fs.readFile(filePath, 'utf-8');
  const issues: LinearIssue[] = JSON.parse(content);

  const errors: ValidationError[] = [];
  issues.forEach((issue, index) => {
    errors.push(...validateLinearIssue(issue, index));
  });

  // Check for duplicate IDs
  const ids = new Set<string>();
  const identifiers = new Set<string>();
  issues.forEach((issue, index) => {
    if (ids.has(issue.id)) {
      errors.push({ file: 'linear.json', index, field: 'id', error: `Duplicate ID: ${issue.id}` });
    }
    ids.add(issue.id);

    if (identifiers.has(issue.identifier)) {
      errors.push({
        file: 'linear.json',
        index,
        field: 'identifier',
        error: `Duplicate identifier: ${issue.identifier}`,
      });
    }
    identifiers.add(issue.identifier);
  });

  validator.addResult({
    file: 'linear.json',
    passed: errors.length === 0,
    itemCount: issues.length,
    errors,
  });
}

// =============================================================================
// Zendesk Validation
// =============================================================================

function validateZendeskTicket(ticket: ZendeskTicket, index: number): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (!ticket.id) {
    errors.push({ file: 'zendesk.json', index, field: 'id', error: 'Missing id' });
  }
  if (!ticket.subject) {
    errors.push({ file: 'zendesk.json', index, field: 'subject', error: 'Missing subject' });
  }
  if (!ticket.description) {
    errors.push({
      file: 'zendesk.json',
      index,
      field: 'description',
      error: 'Missing description',
    });
  }

  // Valid status
  const validStatuses = ['new', 'open', 'pending', 'hold', 'solved', 'closed'];
  if (!validStatuses.includes(ticket.status)) {
    errors.push({
      file: 'zendesk.json',
      index,
      field: 'status',
      error: `Invalid status: ${ticket.status}`,
    });
  }

  // Valid priority (if set)
  if (ticket.priority !== null) {
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    if (!validPriorities.includes(ticket.priority)) {
      errors.push({
        file: 'zendesk.json',
        index,
        field: 'priority',
        error: `Invalid priority: ${ticket.priority}`,
      });
    }
  }

  // Valid type (if set)
  if (ticket.type !== null) {
    const validTypes = ['incident', 'question', 'task', 'problem'];
    if (!validTypes.includes(ticket.type)) {
      errors.push({
        file: 'zendesk.json',
        index,
        field: 'type',
        error: `Invalid type: ${ticket.type}`,
      });
    }
  }

  // Requester ID
  if (!ticket.requester_id) {
    errors.push({
      file: 'zendesk.json',
      index,
      field: 'requester_id',
      error: 'Missing requester_id',
    });
  }

  // Comments structure
  if (!Array.isArray(ticket.comments)) {
    errors.push({
      file: 'zendesk.json',
      index,
      field: 'comments',
      error: 'Invalid comments structure',
    });
  } else {
    // Validate comment IDs are unique
    const commentIds = new Set<number>();
    ticket.comments.forEach((comment, cIdx) => {
      if (commentIds.has(comment.id)) {
        errors.push({
          file: 'zendesk.json',
          index,
          field: `comments[${cIdx}].id`,
          error: `Duplicate comment ID: ${comment.id}`,
        });
      }
      commentIds.add(comment.id);

      // Validate attachments if present
      if (comment.attachments) {
        comment.attachments.forEach((attachment, aIdx) => {
          if (!attachment.file_name || !attachment.content_url) {
            errors.push({
              file: 'zendesk.json',
              index,
              field: `comments[${cIdx}].attachments[${aIdx}]`,
              error: 'Attachment missing file_name or content_url',
            });
          }
        });
      }
    });
  }

  // Timestamps
  if (!ticket.created_at || isNaN(Date.parse(ticket.created_at))) {
    errors.push({ file: 'zendesk.json', index, field: 'created_at', error: 'Invalid created_at' });
  }
  if (!ticket.updated_at || isNaN(Date.parse(ticket.updated_at))) {
    errors.push({ file: 'zendesk.json', index, field: 'updated_at', error: 'Invalid updated_at' });
  }

  // URL format
  if (!ticket.url || !ticket.url.includes('zendesk.com')) {
    errors.push({ file: 'zendesk.json', index, field: 'url', error: 'Invalid URL format' });
  }

  return errors;
}

async function validateZendeskSamples(filePath: string, validator: Validator): Promise<void> {
  console.log('\n🟦 Validating Zendesk samples...');

  const content = await fs.readFile(filePath, 'utf-8');
  const tickets: ZendeskTicket[] = JSON.parse(content);

  const errors: ValidationError[] = [];
  tickets.forEach((ticket, index) => {
    errors.push(...validateZendeskTicket(ticket, index));
  });

  // Check for duplicate IDs
  const ids = new Set<number>();
  tickets.forEach((ticket, index) => {
    if (ids.has(ticket.id)) {
      errors.push({
        file: 'zendesk.json',
        index,
        field: 'id',
        error: `Duplicate ID: ${ticket.id}`,
      });
    }
    ids.add(ticket.id);
  });

  validator.addResult({
    file: 'zendesk.json',
    passed: errors.length === 0,
    itemCount: tickets.length,
    errors,
  });
}

// =============================================================================
// Worst Cases Validation
// =============================================================================

function validateWorstCase(worstCase: WorstCase, index: number): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (!worstCase.case_id) {
    errors.push({ file: 'cases.json', index, field: 'case_id', error: 'Missing case_id' });
  }
  if (!worstCase.description) {
    errors.push({ file: 'cases.json', index, field: 'description', error: 'Missing description' });
  }
  if (!worstCase.challenge) {
    errors.push({ file: 'cases.json', index, field: 'challenge', error: 'Missing challenge' });
  }

  // Valid platform
  if (!['linear', 'zendesk'].includes(worstCase.platform)) {
    errors.push({
      file: 'cases.json',
      index,
      field: 'platform',
      error: `Invalid platform: ${worstCase.platform}`,
    });
  }

  // Valid category
  const validCategories = [
    'long_thread',
    'large_code_block',
    'deep_nesting',
    'many_attachments',
    'mixed_content',
    'deleted_content',
    'relational_complex',
  ];
  if (!validCategories.includes(worstCase.category)) {
    errors.push({
      file: 'cases.json',
      index,
      field: 'category',
      error: `Invalid category: ${worstCase.category}`,
    });
  }

  // Data should exist
  if (!worstCase.data) {
    errors.push({ file: 'cases.json', index, field: 'data', error: 'Missing data' });
  }

  return errors;
}

async function validateWorstCases(filePath: string, validator: Validator): Promise<void> {
  console.log('\n⚠️  Validating worst cases...');

  const content = await fs.readFile(filePath, 'utf-8');
  const cases: WorstCase[] = JSON.parse(content);

  const errors: ValidationError[] = [];
  cases.forEach((worstCase, index) => {
    errors.push(...validateWorstCase(worstCase, index));
  });

  // Check for duplicate case IDs
  const caseIds = new Set<string>();
  cases.forEach((worstCase, index) => {
    if (caseIds.has(worstCase.case_id)) {
      errors.push({
        file: 'cases.json',
        index,
        field: 'case_id',
        error: `Duplicate case_id: ${worstCase.case_id}`,
      });
    }
    caseIds.add(worstCase.case_id);
  });

  validator.addResult({
    file: 'cases.json',
    passed: errors.length === 0,
    itemCount: cases.length,
    errors,
  });
}

// =============================================================================
// Main Execution
// =============================================================================

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              Sample Data Validation                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const dataDir = path.join(process.cwd(), 'data');
  const samplesDir = path.join(dataDir, 'samples');
  const worstCasesDir = path.join(dataDir, 'worst-cases');

  const validator = new Validator();

  try {
    // Validate Linear samples
    await validateLinearSamples(path.join(samplesDir, 'linear.json'), validator);

    // Validate Zendesk samples
    await validateZendeskSamples(path.join(samplesDir, 'zendesk.json'), validator);

    // Validate worst cases
    await validateWorstCases(path.join(worstCasesDir, 'cases.json'), validator);

    // Print summary
    validator.printSummary();
  } catch (error: any) {
    console.error('\n❌ Validation failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Error during validation:', error);
  process.exit(1);
});
