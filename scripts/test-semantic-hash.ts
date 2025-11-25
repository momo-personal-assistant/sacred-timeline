/**
 * Test script for semantic hash and duplicate detection
 */

import { RelationInferrer } from '../packages/graph/src/relation-inferrer';
import {
  generateSemanticHash,
  normalizeText,
  generateFingerprint as _generateFingerprint,
} from '../packages/shared/src/utils/semantic-hash';
import { SlackTransformer, SlackThread } from '../packages/transformers/src/slack-transformer';

console.log('=== Testing Semantic Hash Implementation ===\n');

// Test 1: Basic hash generation
console.log('1. Testing normalizeText():');
const text1 = 'API authentication failing for enterprise customers';
const text2 = 'Authentication failing for enterprise customers API';
console.log(`   Text 1: "${text1}"`);
console.log(`   Text 2: "${text2}"`);
console.log(`   Normalized 1: "${normalizeText(text1)}"`);
console.log(`   Normalized 2: "${normalizeText(text2)}"`);
console.log(`   Same after normalize: ${normalizeText(text1) === normalizeText(text2)}`);

// Test 2: Semantic hash generation
console.log('\n2. Testing generateSemanticHash():');
const hash1 = generateSemanticHash({
  title: 'API authentication failing',
  body: 'Users are reporting 401 errors when trying to authenticate',
  keywords: ['authentication', 'api', 'error'],
});
const hash2 = generateSemanticHash({
  title: 'Authentication failing API',
  body: 'When trying to authenticate, users are reporting 401 errors',
  keywords: ['api', 'authentication', 'error'],
});
const hash3 = generateSemanticHash({
  title: 'Payment processing slow',
  body: 'Customers complaining about slow checkout',
  keywords: ['payment', 'performance', 'checkout'],
});
console.log(`   Hash 1 (auth issue): ${hash1.substring(0, 16)}...`);
console.log(`   Hash 2 (auth issue, reordered): ${hash2.substring(0, 16)}...`);
console.log(`   Hash 3 (payment issue): ${hash3.substring(0, 16)}...`);
console.log(`   Hash 1 == Hash 2: ${hash1 === hash2}`);
console.log(`   Hash 1 == Hash 3: ${hash1 === hash3}`);

// Test 3: SlackTransformer with semantic_hash
console.log('\n3. Testing SlackTransformer with semantic_hash:');
const transformer = new SlackTransformer({ workspace: 'test' });

const thread1: SlackThread = {
  ts: '1732406400.123456',
  channel: 'support',
  messages: [
    {
      ts: '1732406400.123456',
      user_id: 'U001',
      text: 'API authentication is failing for enterprise customers',
      created_at: '2024-11-24T00:00:00Z',
    },
  ],
  participants: ['U001'],
  keywords: ['authentication', 'api', 'enterprise'],
  decision_made: false,
  created_at: '2024-11-24T00:00:00Z',
  updated_at: '2024-11-24T00:00:00Z',
};

const thread2: SlackThread = {
  ts: '1732406500.789012',
  channel: 'support',
  messages: [
    {
      ts: '1732406500.789012',
      user_id: 'U002',
      text: 'Enterprise customers facing API authentication failures',
      created_at: '2024-11-24T00:01:00Z',
    },
  ],
  participants: ['U002'],
  keywords: ['authentication', 'api', 'enterprise'],
  decision_made: false,
  created_at: '2024-11-24T00:01:00Z',
  updated_at: '2024-11-24T00:01:00Z',
};

const canonical1 = transformer.transform(thread1);
const canonical2 = transformer.transform(thread2);

console.log(`   Thread 1 semantic_hash: ${canonical1.semantic_hash?.substring(0, 16)}...`);
console.log(`   Thread 2 semantic_hash: ${canonical2.semantic_hash?.substring(0, 16)}...`);
console.log(
  `   Same hash (potential duplicate): ${canonical1.semantic_hash === canonical2.semantic_hash}`
);

// Test 4: RelationInferrer duplicate detection
console.log('\n4. Testing RelationInferrer.detectDuplicates():');

// Create two objects with same semantic_hash manually for testing
const obj1 = { ...canonical1 };
const obj2 = { ...canonical2, semantic_hash: canonical1.semantic_hash }; // Force same hash

const inferrer = new RelationInferrer({ enableDuplicateDetection: true });
const duplicates = inferrer.detectDuplicates([obj1, obj2]);

console.log(`   Objects with same hash: 2`);
console.log(`   Duplicate relations found: ${duplicates.length}`);
if (duplicates.length > 0) {
  console.log(`   Relation type: ${duplicates[0].type}`);
  console.log(`   Confidence: ${duplicates[0].confidence}`);
  console.log(`   From: ${duplicates[0].from_id.substring(0, 30)}...`);
  console.log(`   To: ${duplicates[0].to_id.substring(0, 30)}...`);
}

// Test 5: Full inferAll with duplicates
console.log('\n5. Testing inferAll() includes duplicate detection:');
const allRelations = inferrer.inferAll([obj1, obj2]);
const byType = allRelations.reduce(
  (acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  },
  {} as Record<string, number>
);
console.log(`   Total relations: ${allRelations.length}`);
console.log(`   By type: ${JSON.stringify(byType)}`);

console.log('\n=== All tests completed ===');
