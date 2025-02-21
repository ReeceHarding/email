import 'dotenv/config';
import axios from 'axios';
import { BusinessInfo, extractBusinessInfo, scrapeUrl } from './test-scrape-system';
import { createBusinessProfile } from '@/actions/db/business-profiles-actions';
import { checkQuota, checkProcessedUrl, markUrlAsProcessed } from './search-utils';
import { searchBusinesses } from './search';

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

export async function searchBusinessesWithBrave(
  query: string,
  onProgress?: (event: string, data: any) => void,
  attempt = 0
): Promise<BraveSearchResult[]> {
  try {
    // Check quota
    if (currentQuota >= QUOTA_LIMIT) {
      throw new Error('Monthly quota exceeded');
    }

    // Enforce rate limiting
    await enforceRateLimit();

    onProgress?.("searchStart", { query });

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
      const results = response.data.web.results.map((r: any) => ({
        url: r.url,
        title: r.title,
        description: r.description
      })) as BraveSearchResult[];

      // Stream partial detail events
      for (const r of results) {
        onProgress?.("searchResult", { url: r.url, title: r.title, description: r.description });
      }

      onProgress?.("searchComplete", {
        query,
        count: results.length,
        results: results.map(r => ({ url: r.url, title: r.title }))
      });

      return results;
    }

    onProgress?.("searchComplete", { query, count: 0, results: [] });
    return [];
  } catch (error: any) {
    console.error('Error searching with Brave:', error.message);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
      
      if (error.response.status === 429) {
        const errorData = error.response.data as BraveErrorResponse;
        if (errorData?.error?.meta?.quota_current) {
          currentQuota = errorData.error.meta.quota_current;
        }
        if (attempt < BACKOFF_DELAYS.length) {
          const waitTime = BACKOFF_DELAYS[attempt];
          console.log(`Rate limited. Retrying in ${waitTime/1000} seconds...`);
          await delay(waitTime);
          return searchBusinessesWithBrave(query, onProgress, attempt + 1);
        }
      }
    }
    onProgress?.("scrapeError", { query, message: error.message });
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
  type:
    | 'search-start'
    | 'searchResult'
    | 'search-complete'
    | 'scrape-start'
    | 'scrape-complete'
    | 'scrape-error'
    | 'rate-limit'
    | 'business-found';
  data: any;
}

export async function searchAndScrape(
  query: string,
  onProgress: (data: any) => void,
  onError: (error: any) => void
) {
  console.log('[SCRAPE] Starting search and scrape for query:', query);
  try {
    // Check if we've hit our quota
    console.log('[SCRAPE] Checking quota limits...');
    const { remaining, resetTime } = await checkQuota();
    
    if (remaining <= 0) {
      console.log('[SCRAPE] Quota exceeded, reset time:', resetTime);
      throw new Error(`Search quota exceeded. Resets at ${resetTime}`);
    }

    // Perform the search
    console.log('[SCRAPE] Performing Google search...');
    const searchResults = await searchBusinesses(query, (evt, payload) => {
      onProgress({ type: evt, data: payload });
    });
    console.log('[SCRAPE] Found', searchResults.length, 'search results');

    // Process each result
    for (const result of searchResults) {
      try {
        console.log('[SCRAPE] Processing result:', result.url);
        
        // Check if URL is already processed
        console.log('[SCRAPE] Checking if URL was previously processed...');
        const isProcessed = await checkProcessedUrl(result.url);
        
        if (isProcessed) {
          console.log('[SCRAPE] URL already processed, skipping:', result.url);
          continue;
        }

        // Scrape the website
        console.log('[SCRAPE] Starting website scrape for:', result.url);
        const scrapedData = await scrapeUrl(result.url);
        
        if (!scrapedData) {
          console.log('[SCRAPE] No data found for:', result.url);
          continue;
        }

        console.log('[SCRAPE] Successfully scraped data from:', result.url);

        // Save to database
        console.log('[SCRAPE] Saving data to database...');
        const dbResult = await createBusinessProfile(
          result.url,
          scrapedData,
          query,
          'search'
        );

        if (dbResult.success) {
          await markUrlAsProcessed(result.url);
        }

        console.log('[SCRAPE] Database save result:', dbResult.success);

        // Report progress
        onProgress({
          url: result.url,
          success: dbResult.success,
          message: dbResult.message
        });

      } catch (error) {
        console.error('[SCRAPE] Error processing result:', result.url, error);
        if (error instanceof Error) {
          console.error('[SCRAPE] Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
          });
        }
        onError({
          url: result.url,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('[SCRAPE] Completed search and scrape for query:', query);
  } catch (error) {
    console.error('[SCRAPE] Fatal error in searchAndScrape:', error);
    if (error instanceof Error) {
      console.error('[SCRAPE] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    throw error;
  }
}

export type { SearchAndScrapeResult, SearchAndScrapeProgress }; 