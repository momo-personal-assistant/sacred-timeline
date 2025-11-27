#!/usr/bin/env tsx
/**
 * Migration script to add YAML frontmatter and reorganize experiment docs
 */

import * as fs from 'fs';
import * as path from 'path';

interface ExperimentMetadata {
  experiment_id: string;
  title: string;
  date: string;
  status: 'completed' | 'draft' | 'running' | 'failed' | 'rejected';
  type: 'results' | 'plan' | 'research';
  baseline_f1?: number;
  result_f1?: number;
  precision?: number;
  recall?: number;
  related_experiments?: string[];
  config_file?: string;
  tags?: string[];
  decision?: 'approved' | 'rejected' | 'pending';
}

const migrations: Record<string, ExperimentMetadata & { target_folder: string }> = {
  'EXP-004-relation-inference-optimization.md': {
    experiment_id: 'EXP-004',
    title: 'Relation Inference Optimization',
    date: '2025-11-27',
    status: 'completed',
    type: 'research',
    result_f1: 0.019,
    tags: ['relation-inference', 'threshold-tuning'],
    decision: 'rejected',
    target_folder: 'rejected',
  },
  'EXP-005-project-based-data.md': {
    experiment_id: 'EXP-005',
    title: 'Project-based Data Generation with Objective Ground Truth',
    date: '2025-11-27',
    status: 'completed',
    type: 'results',
    baseline_f1: 0.019,
    result_f1: 0.283,
    tags: ['project-based-data', 'ground-truth', 'synthetic-data'],
    config_file: 'config/default.yaml',
    decision: 'approved',
    target_folder: 'completed',
  },
  'EXP-006-multi-signal-fusion-plan.md': {
    experiment_id: 'EXP-006',
    title: 'Multi-Signal Fusion Experiment Plan',
    date: '2025-11-27',
    status: 'running',
    type: 'plan',
    baseline_f1: 0.283,
    tags: ['multi-signal-fusion', 'experiment-plan', 'relation-inference'],
    related_experiments: ['EXP-005'],
    decision: 'approved',
    target_folder: 'plans',
  },
  'EXP-006-stage-1-results.md': {
    experiment_id: 'EXP-006-STAGE-1',
    title: 'Threshold Tuning Results',
    date: '2025-11-27',
    status: 'completed',
    type: 'results',
    baseline_f1: 0.283,
    result_f1: 0.436,
    precision: 0.415,
    recall: 0.46,
    tags: ['threshold-tuning', 'multi-signal-fusion', 'exp-006'],
    related_experiments: ['EXP-005'],
    config_file: 'config/experiments/threshold-0.30.yaml',
    decision: 'approved',
    target_folder: 'completed',
  },
  // EXP-006-stage-2-results.md already has frontmatter
};

function generateYamlFrontmatter(meta: ExperimentMetadata): string {
  const yaml: string[] = ['```yaml', '# Experiment Metadata'];

  yaml.push(`experiment_id: ${meta.experiment_id}`);
  yaml.push(`title: "${meta.title}"`);
  yaml.push(`date: ${meta.date}`);
  if (meta.status) yaml.push(`status: ${meta.status}`);
  if (meta.type) yaml.push(`type: ${meta.type}`);

  if (meta.baseline_f1 !== undefined || meta.result_f1 !== undefined) {
    yaml.push('');
    yaml.push('# Performance Metrics');
    if (meta.baseline_f1 !== undefined) yaml.push(`baseline_f1: ${meta.baseline_f1}`);
    if (meta.result_f1 !== undefined) yaml.push(`result_f1: ${meta.result_f1}`);
    if (meta.precision !== undefined) yaml.push(`precision: ${meta.precision}`);
    if (meta.recall !== undefined) yaml.push(`recall: ${meta.recall}`);
  }

  yaml.push('');
  yaml.push('# Related Resources');
  if (meta.related_experiments) {
    yaml.push(`related_experiments: ${JSON.stringify(meta.related_experiments)}`);
  }
  if (meta.config_file) {
    yaml.push(`config_file: '${meta.config_file}'`);
  }

  yaml.push('');
  yaml.push('# Tags');
  yaml.push(`tags: ${JSON.stringify(meta.tags || [])}`);

  if (meta.decision) {
    yaml.push('');
    yaml.push('# Decision');
    yaml.push(`decision: ${meta.decision}`);
  }

  yaml.push('```');

  return yaml.join('\n');
}

async function main() {
  const docsPath = path.join(process.cwd(), 'docs', 'experiments');

  console.log('\n🔄 Migrating experiment documents...\n');

  for (const [filename, meta] of Object.entries(migrations)) {
    const sourcePath = path.join(docsPath, filename);

    if (!fs.existsSync(sourcePath)) {
      console.log(`⏭️  Skip: ${filename} (not found)`);
      continue;
    }

    // Read original content
    const content = fs.readFileSync(sourcePath, 'utf-8');

    // Check if already has frontmatter
    if (content.startsWith('# ') && content.includes('```yaml')) {
      console.log(`✅ Skip: ${filename} (already has frontmatter)`);
      continue;
    }

    // Generate frontmatter
    const frontmatter = generateYamlFrontmatter(meta);

    // Find the first line (title)
    const lines = content.split('\n');
    const titleLine = lines[0];

    // Insert frontmatter after title
    const updatedContent = [titleLine, '', frontmatter, '', ...lines.slice(1)].join('\n');

    // Write updated content
    fs.writeFileSync(sourcePath, updatedContent);

    console.log(`✅ Updated: ${filename}`);

    // Move to target folder
    const targetPath = path.join(docsPath, meta.target_folder, filename);
    fs.renameSync(sourcePath, targetPath);

    console.log(`   📁 Moved to: ${meta.target_folder}/`);
  }

  console.log('\n✨ Migration complete!\n');

  // Show summary
  const summary = {
    completed: 0,
    plans: 0,
    rejected: 0,
  };

  for (const meta of Object.values(migrations)) {
    summary[meta.target_folder as keyof typeof summary]++;
  }

  console.log('📊 Summary:');
  console.log(`   Completed: ${summary.completed}`);
  console.log(`   Plans: ${summary.plans}`);
  console.log(`   Rejected: ${summary.rejected}`);
  console.log('');
}

main().catch(console.error);
