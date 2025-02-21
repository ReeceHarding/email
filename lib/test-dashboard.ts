import 'dotenv/config';
import { generateSearchQueriesAction } from '../actions/generate-search-queries';
import { POST } from '../app/api/search/scrape-stream/route';
import { NextRequest } from 'next/server';

async function testDashboardFlow() {
  console.log('\nTest 4: Lead Finder Dashboard Flow');
  console.log('================================');

  try {
    // Step 1: Generate queries from prompt
    console.log('\nStep 1: Query Generation');
    console.log('-----------------------');
    const testPrompt = "dentists in Austin, Texas";
    console.log(`Testing with prompt: "${testPrompt}"`);
    
    const queries = await generateSearchQueriesAction(testPrompt);
    console.log('Generated queries result:', JSON.stringify(queries, null, 2));
    
    if (!queries || !queries.queries || queries.queries.length === 0) {
      console.error('❌ Step 1 failed: No queries generated');
      return false;
    }
    console.log('\nGenerated queries:', queries.queries);
    console.log('✅ Step 1 passed: Queries generated successfully');

    // Step 2: Test SSE endpoint with generated queries
    console.log('\nStep 2: SSE Processing');
    console.log('--------------------');
    const request = new NextRequest('http://localhost:3000/api/search/scrape-stream', {
      method: 'POST',
      body: JSON.stringify({ queries: queries.queries })
    });

    const response = await POST(request);
    if (response.status !== 200) {
      console.error('❌ Step 2 failed: Wrong status code:', response.status);
      return false;
    }

    // Read and verify the stream
    const reader = response.body?.getReader();
    if (!reader) {
      console.error('❌ Step 2 failed: No response body reader');
      return false;
    }

    console.log('\nProcessing stream events:');
    let receivedStart = false;
    let receivedProfile = false;
    let receivedComplete = false;
    let receivedDone = false;
    let businessProfiles = 0;
    let isRunning = true;

    while (isRunning) {
      const { done, value } = await reader.read();
      if (done) break;

      const events = new TextDecoder()
        .decode(value)
        .split('\n\n')
        .filter(e => e.trim());

      for (const event of events) {
        const [eventLine, dataLine] = event.split('\n');
        const eventType = eventLine.replace('event: ', '');
        const data = JSON.parse(dataLine.replace('data: ', ''));

        console.log(`\nReceived event: ${eventType}`);
        
        switch (eventType) {
          case 'queryStart':
            receivedStart = true;
            console.log('Processing query:', data.query);
            break;
          case 'businessProfile':
            receivedProfile = true;
            businessProfiles++;
            console.log('Found business:', data.business_name, '-', data.website_url);
            break;
          case 'queryComplete':
            receivedComplete = true;
            console.log('Completed query:', data.query);
            break;
          case 'done':
            receivedDone = true;
            console.log('All queries processed');
            isRunning = false;
            break;
        }
      }
    }

    // Verify all events were received
    const allEventsReceived = receivedStart && receivedProfile && receivedComplete && receivedDone;
    if (!allEventsReceived) {
      console.error('❌ Step 2 failed: Missing some events');
      return false;
    }

    console.log(`\nFound ${businessProfiles} business profiles`);
    if (businessProfiles === 0) {
      console.error('❌ Step 2 failed: No business profiles found');
      return false;
    }

    console.log('✅ Step 2 passed: SSE processing completed successfully');
    console.log('\n✅ Test passed: Dashboard flow working correctly');
    return true;
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    return false;
  }
}

// Run the test
testDashboardFlow().then(passed => {
  if (!passed) {
    process.exit(1);
  }
  process.exit(0);
}); 