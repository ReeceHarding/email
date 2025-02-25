/**
 * Test script for Brave Search API integration
 * Run with: npm run test:brave-search
 */

import { search, getSearchStats } from '../lib/search-service';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testBraveSearch() {
  console.log('🔍 Testing Brave Search API Integration');
  console.log('=======================================');
  
  // Test query parameters
  const queries = [
    'dentists in dallas texas',
    'marketing agencies in new york city',
    'software development firms in san francisco'
  ];
  
  try {
    // Run searches for each query
    for (const query of queries) {
      console.log(`\n📝 Searching for: "${query}"`);
      
      const startTime = Date.now();
      const results = await search(query);
      const duration = Date.now() - startTime;
      
      console.log(`✅ Found ${results.length} results in ${duration}ms`);
      
      // Display the first 3 results
      if (results.length > 0) {
        console.log('\n🌐 Top results:');
        results.slice(0, 3).forEach((result, index) => {
          console.log(`\n[${index + 1}] ${result.title}`);
          console.log(`    URL: ${result.url}`);
          console.log(`    Source: ${result.source}`);
          console.log(`    Description: ${result.description.substring(0, 100)}...`);
        });
      }
      
      // Show stats after each query
      const stats = getSearchStats();
      console.log('\n📊 Search API Stats:');
      console.log(`    Total Requests: ${stats.totalRequests}`);
      console.log(`    Successful: ${stats.successfulRequests}`);
      console.log(`    Failed: ${stats.failedRequests}`);
      console.log(`    Rate Limited: ${stats.rateLimitedRequests}`);
      console.log(`    Avg Response Time: ${Math.round(stats.averageResponseTime)}ms`);
    }
    
    console.log('\n🎉 All tests completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during testing:', error);
    process.exit(1);
  }
}

// Run the test
testBraveSearch().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 