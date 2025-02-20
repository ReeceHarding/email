import 'dotenv/config';
import axios from 'axios';
import { BusinessInfo, extractBusinessInfo, scrapeUrl } from './test-scrape-system';
import { createBusinessProfile } from '../actions/db/business-profiles-actions';

const BRAVE_API_KEY = process.env.BRAVE_API_KEY!;
const SCRAPING_BEE_API_KEY = process.env.SCRAPING_BEE_API_KEY!;

// Rate limiting configuration
const RATE_LIMIT = 1; // requests per second
const QUOTA_LIMIT = 2000; // requests per month
let currentQuota = 0;
let lastRequestTime = 0;
const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff in ms

interface BraveSearchResult {
  url: string;
  title: string;
  description: string;
}

interface BraveErrorResponse {
  type: string;
  error: {
    id: string;
    status: number;
    code: string;
    detail: string;
    meta: {
      plan: string;
      rate_limit: number;
      rate_current: number;
      quota_limit: number;
      quota_current: number;
      component: string;
    };
  };
  time: number;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enforceRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  const minInterval = 1000 / RATE_LIMIT;

  if (timeSinceLastRequest < minInterval) {
    const waitTime = minInterval - timeSinceLastRequest;
    await delay(waitTime);
  }

  lastRequestTime = Date.now();
}

async function searchBusinesses(query: string, attempt = 0): Promise<BraveSearchResult[]> {
  try {
    // Check quota
    if (currentQuota >= QUOTA_LIMIT) {
      throw new Error('Monthly quota exceeded');
    }

    // Enforce rate limiting
    await enforceRateLimit();

    console.log('Searching Brave for:', query);
    const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      params: {
        q: query,
        result_filter: 'web'
      },
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY
      }
    });

    // Update quota if response includes it
    if (response.data?.error?.meta?.quota_current) {
      currentQuota = response.data.error.meta.quota_current;
    }

    if (response.data && response.data.web && response.data.web.results) {
      return response.data.web.results.map((result: any) => ({
        url: result.url,
        title: result.title,
        description: result.description
      }));
    }

    return [];
  } catch (error: any) {
    console.error('Error searching with Brave:', error.message);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
      
      // Handle rate limiting error
      if (error.response.status === 429) {
        const errorData = error.response.data as BraveErrorResponse;
        if (errorData?.error?.meta?.quota_current) {
          currentQuota = errorData.error.meta.quota_current;
        }

        // If we haven't exceeded max retries, wait and try again
        if (attempt < BACKOFF_DELAYS.length) {
          const waitTime = BACKOFF_DELAYS[attempt];
          console.log(`Rate limited. Retrying in ${waitTime/1000} seconds...`);
          await delay(waitTime);
          return searchBusinesses(query, attempt + 1);
        }
      }
    }
    return [];
  }
}

function displayBusinessInfo(businessInfo: BusinessInfo) {
  console.log('\nExtracted Business Information:');
  console.log('=============================');
  
  if (businessInfo.name) console.log('Practice Name:', businessInfo.name);
  if (businessInfo.title) console.log('Page Title:', businessInfo.title);
  if (businessInfo.description) console.log('Description:', businessInfo.description);
  
  console.log('\nContact Information:');
  console.log('-------------------');
  if (businessInfo.address) console.log('Full Address:', businessInfo.address);
  if (businessInfo.city) console.log('City:', businessInfo.city);
  if (businessInfo.state) console.log('State:', businessInfo.state);
  if (businessInfo.zip) console.log('ZIP:', businessInfo.zip);
  if (businessInfo.phone) console.log('Phone:', businessInfo.phone);
  if (businessInfo.email) console.log('Email:', businessInfo.email);
  
  if (businessInfo.hours && businessInfo.hours.length > 0) {
    console.log('\nBusiness Hours:');
    console.log('---------------');
    businessInfo.hours.forEach(hour => console.log(`- ${hour}`));
  }
  
  if (businessInfo.services && businessInfo.services.length > 0) {
    console.log('\nServices:');
    console.log('---------');
    businessInfo.services.forEach(service => console.log(`- ${service}`));
  }

  if (businessInfo.procedures && businessInfo.procedures.length > 0) {
    console.log('\nProcedures:');
    console.log('-----------');
    businessInfo.procedures.forEach(proc => console.log(`- ${proc}`));
  }

  if (businessInfo.specialties && businessInfo.specialties.length > 0) {
    console.log('\nSpecialties:');
    console.log('------------');
    businessInfo.specialties.forEach(specialty => console.log(`- ${specialty}`));
  }

  if (businessInfo.education && businessInfo.education.length > 0) {
    console.log('\nEducation:');
    console.log('----------');
    businessInfo.education.forEach(edu => console.log(`- ${edu}`));
  }

  if (businessInfo.affiliations && businessInfo.affiliations.length > 0) {
    console.log('\nProfessional Affiliations:');
    console.log('------------------------');
    businessInfo.affiliations.forEach(aff => console.log(`- ${aff}`));
  }

  if (businessInfo.insurances && businessInfo.insurances.length > 0) {
    console.log('\nInsurance Information:');
    console.log('---------------------');
    businessInfo.insurances.forEach(insurance => console.log(`- ${insurance}`));
  }

  if (businessInfo.emergencyInfo) {
    console.log('\nEmergency Information:');
    console.log('---------------------');
    console.log(businessInfo.emergencyInfo);
  }
  
  if (businessInfo.socialLinks && Object.keys(businessInfo.socialLinks).length > 0) {
    console.log('\nSocial Media & Reviews:');
    console.log('----------------------');
    Object.entries(businessInfo.socialLinks).forEach(([platform, url]) => {
      console.log(`- ${platform}: ${url}`);
    });
  }
}

interface SearchAndScrapeResult {
  url: string;
  businessInfo: BusinessInfo;
}

interface SearchAndScrapeProgress {
  type: 'search-start' | 'search-result' | 'search-complete' | 'scrape-start' | 'scrape-complete' | 'scrape-error' | 'rate-limit' | 'business-found';
  data: any;
}

async function searchAndScrape(
  query: string,
  onProgress?: (progress: SearchAndScrapeProgress) => void
): Promise<SearchAndScrapeResult[]> {
  console.log(`\nSearching for: ${query}`);
  console.log('='.repeat(50));

  // Notify search start
  onProgress?.({ type: 'search-start', data: { query } });

  // Search for businesses
  const searchResults = await searchBusinesses(query);
  console.log(`\nFound ${searchResults.length} results`);

  // Notify search results
  onProgress?.({ 
    type: 'search-complete', 
    data: { 
      query,
      count: searchResults.length,
      results: searchResults.map(r => ({ url: r.url, title: r.title }))
    } 
  });

  const results: SearchAndScrapeResult[] = [];

  // Process only first 2 results as requested
  const resultsToProcess = searchResults.slice(0, 2);

  // Process each result
  for (let i = 0; i < resultsToProcess.length; i++) {
    const result = resultsToProcess[i];
    console.log(`\nProcessing result ${i + 1} of ${resultsToProcess.length}`);
    console.log('URL:', result.url);
    console.log('Title:', result.title);
    console.log('-'.repeat(50));

    try {
      // Skip non-website results or obvious non-dental sites
      if (result.url.includes('facebook.com') || 
          result.url.includes('yelp.com') ||
          result.url.includes('healthgrades.com') ||
          result.url.includes('ratemds.com') ||
          result.url.includes('youtube.com') ||
          result.url.includes('instagram.com') ||
          result.url.includes('twitter.com') ||
          result.url.includes('linkedin.com')) {
        onProgress?.({ 
          type: 'scrape-error', 
          data: { 
            url: result.url,
            reason: 'Skipping social media or review site'
          } 
        });
        continue;
      }

      // Notify scrape start
      onProgress?.({ 
        type: 'scrape-start', 
        data: { 
          url: result.url,
          title: result.title,
          index: i + 1,
          total: resultsToProcess.length
        } 
      });

      // Scrape the website
      console.log(`Scraping URL: ${result.url}`);
      const businessInfo = await scrapeUrl(result.url);
      displayBusinessInfo(businessInfo);

      // Notify business found
      onProgress?.({ 
        type: 'business-found', 
        data: { 
          url: result.url,
          businessInfo
        } 
      });

      // Store the profile in the database
      console.log('\nStoring business profile...');
      const storeResult = await createBusinessProfile(
        result.url,
        businessInfo,
        result.url, // source URL is the same as website URL in this case
        'search'
      );

      // Notify scrape complete
      onProgress?.({ 
        type: 'scrape-complete', 
        data: { 
          url: result.url,
          success: storeResult.success,
          message: storeResult.message
        } 
      });

      if (storeResult.success) {
        console.log('✓ Profile stored successfully');
      } else {
        console.log('✗ Failed to store profile:', storeResult.message);
      }

      // Add the result regardless of storage success
      results.push({
        url: result.url,
        businessInfo
      });

      // Wait between scrapes to avoid rate limiting
      if (i < resultsToProcess.length - 1) {
        console.log('\nWaiting before next scrape...');
        await delay(5000);
      }
    } catch (error: any) {
      console.error(`Error processing ${result.url}:`, error.message);
      onProgress?.({ 
        type: 'scrape-error', 
        data: { 
          url: result.url,
          error: error.message
        } 
      });
    }
  }

  return results;
}

// Export the main function and types
export { searchAndScrape }
export type { SearchAndScrapeResult, SearchAndScrapeProgress } 