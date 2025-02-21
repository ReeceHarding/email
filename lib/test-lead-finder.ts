import 'dotenv/config';
import { generateSearchQueriesAction } from '../actions/generate-search-queries';
import { searchAndScrape } from './search-and-scrape';

async function testQueryGeneration() {
  console.log('\nTest 1: LLM Query Generation');
  console.log('============================');
  
  try {
    const testPrompt = "dentists in Austin, Texas";
    console.log(`Testing with prompt: "${testPrompt}"`);
    
    const result = await generateSearchQueriesAction(testPrompt);
    
    if (!result || !result.queries || result.queries.length === 0) {
      console.error('❌ Test failed: No queries generated');
      return false;
    }
    
    console.log('Generated queries:', result.queries);
    console.log('✅ Test passed: Queries generated successfully');
    return true;
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    return false;
  }
}

async function testSearchAndScrape() {
  console.log('\nTest 2: Search and Scrape Functionality');
  console.log('=====================================');
  
  try {
    const testQuery = "dentists in Austin, Texas";
    console.log(`Testing with query: "${testQuery}"`);
    
    let foundResults = false;
    let hasError = false;
    
    try {
      await searchAndScrape(
        testQuery,
        (data) => {
          console.log('Progress:', data);
          if (data.type === 'business-found') {
            foundResults = true;
          }
        },
        (error) => {
          console.error('Error:', error);
          hasError = true;
        }
      );
      
      if (!foundResults && !hasError) {
        console.error('❌ Test failed: No results found');
        return false;
      }
      
      console.log('✅ Test passed: Search and scrape successful');
      return true;
    } catch (error) {
      console.error('\n❌ Test failed with error:', error);
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