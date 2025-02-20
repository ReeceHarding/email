import 'dotenv/config';
import { generateSearchQueriesAction } from '../actions/generate-search-queries';
import { searchAndScrape } from './search-and-scrape';

async function testQueryGeneration() {
  console.log('\nTest 1: LLM Query Generation');
  console.log('============================');
  
  try {
    const testPrompt = "dentists in Texas";
    console.log(`Testing with prompt: "${testPrompt}"`);
    
    const queries = await generateSearchQueriesAction(testPrompt);
    
    if (!queries || queries.length === 0) {
      console.error('❌ Test failed: No queries generated');
      return false;
    }
    
    console.log('\nGenerated queries:');
    queries.forEach((q, i) => console.log(`${i + 1}. ${q}`));
    
    if (queries.length >= 3) {
      console.log('\n✅ Test passed: Generated multiple relevant queries');
      return true;
    } else {
      console.error('\n❌ Test failed: Not enough queries generated');
      return false;
    }
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    return false;
  }
}

async function testSearchAndScrape() {
  console.log('\nTest 2: Search and Scrape Functionality');
  console.log('=====================================');
  
  try {
    const testQuery = "dentists in Houston, Texas";
    console.log(`Testing with query: "${testQuery}"`);
    
    const results = await searchAndScrape(testQuery);
    
    if (!results || results.length === 0) {
      console.error('❌ Test failed: No results found');
      return false;
    }
    
    console.log('\nSearch results:');
    results.forEach((result, i) => {
      console.log(`\nResult ${i + 1}:`);
      console.log(`URL: ${result.url}`);
      console.log('Business Info:', result.businessInfo);
    });
    
    const hasValidData = results.some(r => 
      r.businessInfo && 
      r.url && 
      (r.businessInfo.name || r.businessInfo.email)
    );
    
    if (hasValidData) {
      console.log('\n✅ Test passed: Found valid business data');
      return true;
    } else {
      console.error('\n❌ Test failed: No valid business data found');
      return false;
    }
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    return false;
  }
}

async function runTests() {
  console.log('Starting Lead Finder Tests...\n');
  
  const results = {
    queryGeneration: await testQueryGeneration(),
    searchAndScrape: await testSearchAndScrape()
  };
  
  console.log('\nTest Results Summary:');
  console.log('====================');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${test}: ${passed ? '✅ Passed' : '❌ Failed'}`);
  });
  
  const allPassed = Object.values(results).every(r => r);
  if (allPassed) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.error('\n❌ Some tests failed');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Tests failed with error:', error);
  process.exit(1);
}); 