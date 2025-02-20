import 'dotenv/config';
import { scrapeWebsite, ScrapeResult } from './firecrawl';
import { createLead } from '../actions/db/leads-actions';

// Use a single test URL - can be changed via command line arg
const TEST_URL = process.argv[2] || 'https://about.google';
const TEST_USER_ID = 'test-user-123';

// Add colors for better visibility
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m"
};

function log(message: string, color = colors.reset) {
  console.log(color + message + colors.reset);
}

function validateScrapeResult(result: ScrapeResult) {
  log('\nValidating scrape result:', colors.bright);
  
  if (!result.success) {
    log('Scrape failed: ' + JSON.stringify(result.error, null, 2), colors.red);
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
    log(`${passed ? '✓' : '✗'} ${message}`, passed ? colors.green : colors.red);
    if (!passed) allValid = false;
  });

  if (result.businessData) {
    log('\nExtracted business data:', colors.bright);
    
    // Basic Info
    if (result.businessData.businessName) log('- Business Name: ' + result.businessData.businessName, colors.cyan);
    if (result.businessData.description) log('- Description: ' + result.businessData.description);
    if (result.businessData.industry) log('- Industry: ' + result.businessData.industry);
    if (result.businessData.yearFounded) log('- Year Founded: ' + result.businessData.yearFounded);
    if (result.businessData.companySize) log('- Company Size: ' + result.businessData.companySize);
    
    // Contact Info
    if (result.businessData.contactEmail) log('- Contact Email: ' + result.businessData.contactEmail, colors.cyan);
    if (result.businessData.phoneNumber) log('- Phone: ' + result.businessData.phoneNumber);
    if (result.businessData.address) log('- Address: ' + result.businessData.address);
    
    // Social Media
    if (result.businessData.socialMedia && Object.keys(result.businessData.socialMedia).length > 0) {
      log('- Social Media:', colors.bright);
      Object.entries(result.businessData.socialMedia).forEach(([platform, url]) => {
        log(`  - ${platform}: ${url}`);
      });
    }
    
    // Team Information
    if (result.businessData.founders && result.businessData.founders.length > 0) {
      log('- Founders:', colors.bright);
      result.businessData.founders.forEach(founder => {
        log(`  - ${founder.name}${founder.title ? ` (${founder.title})` : ''}`, colors.cyan);
        if (founder.email) log(`    Email: ${founder.email}`, colors.yellow);
        if (founder.linkedin) log(`    LinkedIn: ${founder.linkedin}`);
        if (founder.bio) log(`    Bio: ${founder.bio}`);
      });
    }
    
    if (result.businessData.teamMembers && result.businessData.teamMembers.length > 0) {
      log('- Team Members:', colors.bright);
      result.businessData.teamMembers.forEach(member => {
        log(`  - ${member.name}${member.title ? ` (${member.title})` : ''}`, colors.cyan);
        if (member.email) log(`    Email: ${member.email}`, colors.yellow);
        if (member.linkedin) log(`    LinkedIn: ${member.linkedin}`);
      });
    }
    
    // Additional Data
    if (result.businessData.allEmails && result.businessData.allEmails.length > 0) {
      log('- All Discovered Emails:', colors.bright);
      result.businessData.allEmails.forEach(email => {
        log(`  - ${email}`, colors.yellow);
      });
    }
    
    if (result.businessData.scrapedPages && result.businessData.scrapedPages.length > 0) {
      log('\nScraped Pages:', colors.bright);
      result.businessData.scrapedPages.forEach(page => {
        log(`- ${page.url}${page.type ? ` (${page.type})` : ''}`, colors.blue);
      });
    }

    // Debug raw HTML content if needed
    if (process.env.DEBUG === 'true' && result.html) {
      log('\nRaw HTML Preview (first 500 chars):', colors.bright);
      log(result.html.slice(0, 500) + '...');
    }
  }

  return allValid;
}

async function testScrape() {
  log(`\nTesting URL: ${TEST_URL}`, colors.bright);
  log('='.repeat(50), colors.bright);
  
  const startTime = Date.now();
  
  try {
    // 1. Scrape the website
    log('\nScraping website...', colors.blue);
    const result = await scrapeWebsite(TEST_URL);
    const isValid = validateScrapeResult(result);
    
    // 2. Store the data if scrape was successful
    if (isValid && result.businessData) {
      log('\nStoring data in database...', colors.blue);
      const dbResult = await createLead(TEST_USER_ID, TEST_URL, result.businessData);
      
      if (dbResult.success) {
        log('✓ Data stored successfully', colors.green);
        if (dbResult.data?.id) {
          log('Lead ID: ' + dbResult.data.id);
        }
      } else {
        log('✗ Failed to store data: ' + dbResult.message, colors.red);
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`\nTest completed in ${duration}s`, colors.bright);
    log('Result: ' + (isValid ? 'PASSED' : 'FAILED'), isValid ? colors.green : colors.red);
    
  } catch (error) {
    log('Test failed with error:', colors.red);
    console.error(error);
  }
}

// Allow running with DEBUG=true for more output
// Example: DEBUG=true npx ts-node lib/test-scrape.ts https://example.com
testScrape().catch(console.error); 