#!/usr/bin/env tsx
/**
 * Test the match-feedback-v2 endpoint
 */

async function testEndpoint() {
  try {
    console.log('\n🧪 Testing match-feedback-v2 endpoint...\n');

    const response = await fetch('http://localhost:3000/api/momo/match-feedback-v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        minScore: 0.3,
        useEmbeddings: true,
        persistMatches: false,
        workspace: 'tenxai',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ Error ${response.status}: ${text}`);
      return;
    }

    const data = await response.json();

    console.log('✅ Response received:');
    console.log(`\n📊 Summary:`);
    console.log(JSON.stringify(data.summary, null, 2));

    if (data.matches && data.matches.length > 0) {
      console.log(`\n📋 First 5 matches:`);
      for (let i = 0; i < Math.min(5, data.matches.length); i++) {
        const match = data.matches[i];
        console.log(`\n  ${i + 1}. Issue: ${match.issueId} → Feedback: ${match.feedbackId}`);
        console.log(`     Score: ${match.matchScore}`);
        console.log(`     Method: ${match.method}`);
        console.log(`     Reasons: ${match.matchReasons.join(', ')}`);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testEndpoint();
