import 'dotenv/config';
import { scrapeWebsite, ScrapeResult } from './firecrawl';
import { createLead } from '../actions/db/leads-actions';

const TEST_URLS = [
  'https://www.apple.com',
  'https://www.microsoft.com',
  'https://www.amazon.com'
];

const TEST_USER_ID = 'test-user-123'; // We'll use this as a placeholder user ID

function validateScrapeResult(result: ScrapeResult) {
  console.log('\nValidating scrape result:');
  
  if (!result.success) {
    console.error('Scrape failed:', result.error);
    return false;
  }

  const validations = [
    {
      check: () => result.html && result.html.length > 0,
      message: 'HTML content present'
    },
    {
      check: () => result.markdown && result.markdown.length > 0,
      message: 'Markdown content present'
    },
    {
      check: () => result.businessData && Object.keys(result.businessData).length > 0,
      message: 'Business data extracted'
    }
  ];

  let allValid = true;
  validations.forEach(({ check, message }) => {
    const passed = check();
    console.log(`${passed ? '✓' : '✗'} ${message}`);
    if (!passed) allValid = false;
  });

  if (result.businessData) {
    console.log('\nExtracted business data:');
    Object.entries(result.businessData).forEach(([key, value]) => {
      if (value && (typeof value === 'string' || Object.keys(value).length > 0)) {
        console.log(`- ${key}:`, value);
      }
    });
  }

  return allValid;
}

async function testScrape() {
  console.log('Starting scrape tests...\n');
  
  for (const url of TEST_URLS) {
    console.log(`\nTesting URL: ${url}`);
    console.log('='.repeat(50));
    
    try {
      // 1. Scrape the website
      const result = await scrapeWebsite(url);
      const isValid = validateScrapeResult(result);
      
      // 2. Store the data if scrape was successful
      if (isValid && result.businessData) {
        console.log('\nStoring data in database...');
        const dbResult = await createLead(TEST_USER_ID, url, result.businessData);
        
        if (dbResult.success) {
          console.log('✓ Data stored successfully');
          if (dbResult.data?.id) {
            console.log('Lead ID:', dbResult.data.id);
          }
        } else {
          console.log('✗ Failed to store data:', dbResult.message);
        }
      }
      
      console.log('\nTest result:', isValid ? 'PASSED' : 'FAILED');
    } catch (error) {
      console.error('Test failed with error:', error);
    }
  }
}

testScrape().catch(console.error); 