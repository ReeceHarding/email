import 'dotenv/config';
import { POST } from '../app/api/search/scrape-stream/route';
import { NextRequest } from 'next/server';

async function testSSEEndpoint() {
  console.log('\nTest 3: SSE Endpoint – Response Format');
  console.log('=====================================');

  try {
    // Create a test request with queries
    const testQueries = ['dentists in Houston, Texas'];
    const request = new NextRequest('http://localhost:3000/api/search/scrape-stream', {
      method: 'POST',
      body: JSON.stringify({ queries: testQueries })
    });

    // Call the endpoint
    const response = await POST(request);

    // Check response status
    if (response.status !== 200) {
      console.error('❌ Test failed: Wrong status code:', response.status);
      return false;
    }

    // Check headers
    const contentType = response.headers.get('Content-Type');
    const cacheControl = response.headers.get('Cache-Control');
    const connection = response.headers.get('Connection');

    console.log('\nResponse Headers:');
    console.log('Content-Type:', contentType);
    console.log('Cache-Control:', cacheControl);
    console.log('Connection:', connection);

    if (contentType !== 'text/event-stream') {
      console.error('❌ Test failed: Wrong content type:', contentType);
      return false;
    }

    if (!cacheControl?.includes('no-cache')) {
      console.error('❌ Test failed: Missing no-cache in Cache-Control');
      return false;
    }

    if (connection !== 'keep-alive') {
      console.error('❌ Test failed: Connection header should be keep-alive');
      return false;
    }

    // Read and verify the stream
    const reader = response.body?.getReader();
    if (!reader) {
      console.error('❌ Test failed: No response body reader');
      return false;
    }

    console.log('\nReading stream events:');
    let receivedStart = false;
    let receivedProfile = false;
    let receivedComplete = false;
    let receivedDone = false;

    while (true) {
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
        console.log('Data:', data);

        switch (eventType) {
          case 'queryStart':
            receivedStart = true;
            break;
          case 'businessProfile':
            receivedProfile = true;
            break;
          case 'queryComplete':
            receivedComplete = true;
            break;
          case 'done':
            receivedDone = true;
            break;
        }
      }
    }

    // Verify we received all expected event types
    if (!receivedStart) {
      console.error('❌ Test failed: No queryStart event received');
      return false;
    }
    if (!receivedProfile) {
      console.error('❌ Test failed: No businessProfile event received');
      return false;
    }
    if (!receivedComplete) {
      console.error('❌ Test failed: No queryComplete event received');
      return false;
    }
    if (!receivedDone) {
      console.error('❌ Test failed: No done event received');
      return false;
    }

    console.log('\n✅ Test passed: SSE endpoint working correctly');
    return true;
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    return false;
  }
}

// Run the test
testSSEEndpoint().then(passed => {
  if (!passed) {
    process.exit(1);
  }
  process.exit(0);
}); 