import 'dotenv/config';
import axios from 'axios';
import { BusinessInfo, extractBusinessInfo, scrapeUrl } from './test-scrape-system';
import { createBusinessProfile } from '../actions/db/business-profiles-actions';
import { checkQuota, checkProcessedUrl, markUrlAsProcessed } from './search-utils';
import { searchBusinesses } from './search';
import * as cheerio from 'cheerio';

const BRAVE_API_KEY = process.env.BRAVE_API_KEY!;
const SCRAPING_BEE_API_KEY = process.env.SCRAPING_BEE_API_KEY!;

// Rate limiting configuration
const RATE_LIMIT = 1; // requests per second
const QUOTA_LIMIT = 2000; // requests per month
let currentQuota = 0;
let lastRequestTime = 0;
const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff in ms

// Add at the top with other constants
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0'
};

// Page type detection patterns
const PAGE_PATTERNS = {
  about: [/about(-us)?/, /our-story/, /who-we-are/, /our-practice/, /mission/],
  team: [/team/, /staff/, /doctors?/, /physicians?/, /providers?/, /our-team/, /meet-.*team/, /medical-staff/],
  services: [
    // Common medical services
    /services/, /treatments?/, /procedures/, /what-we-do/, /our-services/, /specialties/,
    // Specific conditions and treatments
    /therapy/, /(back|neck|shoulder|arm|leg|elbow|wrist)-pain/,
    /sciatica/, /scoliosis/, /stenosis/, /herniated-disc/, /pinched-nerve/,
    /headaches/, /vertigo/, /whiplash/, /carpal-tunnel/,
    // Types of care
    /wellness-care/, /sports-injuries/, /auto-accident/, /work-injury/
  ],
  contact: [/contact(-us)?/, /locations?/, /offices?/, /find-us/, /directions/, /appointments?/, /schedule/],
  blog: [/blog/, /news/, /insights/, /articles/, /resources/],
  patient: [/patients?/, /new-patients?/, /patient-forms?/, /patient-info/, /insurance/]
};

// Maximum pages to scrape per domain
const MAX_PAGES_PER_DOMAIN = 20; // Increased to capture more service pages

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

// Type for error handling
interface ScrapeError extends Error {
  response?: {
    status: number;
  };
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

// Validate URL before adding to queue
async function isValidUrl(url: string): Promise<boolean> {
  try {
    console.log(`[URLValidation] Checking URL: ${url}`);
    const response = await axios.head(url, { 
      timeout: 5000,
      validateStatus: (status) => {
        console.log(`[URLValidation] Status for ${url}: ${status}`);
        return status === 200;
      }
    });
    return response.status === 200;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log(`[URLValidation] Failed for ${url}: ${error.response?.status || error.message}`);
    }
    return false;
  }
}

// Track successful and failed patterns per domain
const domainPatterns = new Map<string, {
  successful: Set<string>;
  failed: Set<string>;
}>();

// Normalize URL to handle various formats
function normalizeUrl(url: string, baseUrl: string): string | null {
  try {
    // Clean the URL
    const cleanUrl = url.trim()
      .replace(/([^:]\/)\/+/g, '$1') // Remove duplicate slashes
      .replace(/\/$/, ''); // Remove trailing slash
    
    // Convert to absolute URL
    const absoluteUrl = new URL(cleanUrl, baseUrl);
    
    // Ensure same domain
    if (absoluteUrl.hostname !== new URL(baseUrl).hostname) {
      return null;
    }
    
    // Remove query params and hash
    absoluteUrl.search = '';
    absoluteUrl.hash = '';
    
    return absoluteUrl.href;
  } catch (error) {
    console.log(`[URLNormalization] Error normalizing URL: ${url}`, error);
    return null;
  }
}

// Enhanced page discovery with pattern learning
async function discoverPages(baseUrl: string): Promise<Map<string, string[]>> {
  console.log(`\n[PageDiscovery] Starting discovery for: ${baseUrl}`);
  
  // Add timing tracking
  const startTime = Date.now();
  let requestCount = 0;
  
  const queue: string[] = [baseUrl];
  const visited = new Set<string>();
  let pageCount = 0;
  
  // Track pattern stats
  const patterns = {
    successful: new Set<string>(),
    failed: new Set<string>()
  };

  // Initialize pages map
  const pages = new Map<string, string[]>();
  Object.keys(PAGE_PATTERNS).forEach(type => pages.set(type, []));
  
  const validationResults = new Map<string, {
    isValid: boolean;
    statusCode?: number;
    error?: string;
    timing?: number;
  }>();

  console.log(`[PatternLearning] Current domain patterns:`, patterns);

  while (queue.length > 0 && pageCount < MAX_PAGES_PER_DOMAIN) {
    const url = queue.shift()!;
    if (visited.has(url)) {
      console.log(`[PageDiscovery] Skipping already visited URL: ${url}`);
      continue;
    }
    
    console.log(`\n[PageDiscovery] Processing URL: ${url}`);
    visited.add(url);
    requestCount++;

    // Add request timing tracking
    const requestStart = Date.now();

    try {
      // First try GET request instead of HEAD
      console.log(`[URLValidation] Fetching URL: ${url}`);
      const response = await axios.get(url, { 
        timeout: 10000,
        maxRedirects: 5,
        headers: BROWSER_HEADERS
      });
      
      const requestTime = Date.now() - requestStart;
      console.log(`[URLValidation] Successful GET for ${url} (${requestTime}ms)`);
      
      validationResults.set(url, {
        isValid: true,
        statusCode: response.status,
        timing: requestTime
      });

      // Process the HTML content
      const $ = cheerio.load(response.data);
      
      // Log page info
      const pageTitle = $('title').text().trim();
      const metaDescription = $('meta[name="description"]').attr('content');
      console.log(`[PageDiscovery] Found page:`, {
        url,
        title: pageTitle,
        description: metaDescription?.slice(0, 100)
      });

      // Categorize the page
      const urlPath = new URL(url).pathname.toLowerCase();
      let pageType = 'other';
      
      for (const [type, patterns] of Object.entries(PAGE_PATTERNS)) {
        if (patterns.some(pattern => pattern.test(urlPath))) {
          pageType = type;
          console.log(`[PageDiscovery] Categorized as ${type} page: ${url}`);
          if (!pages.has(type)) pages.set(type, []);
          pages.get(type)!.push(url);
          break;
        }
      }

      // Extract and queue new URLs
      $('a[href]').each((_, element) => {
        try {
          const href = $(element).attr('href');
          if (!href) return;

          const normalizedUrl = normalizeUrl(href, url);
          if (!normalizedUrl) return;

          const urlObj = new URL(normalizedUrl);
          
          // Skip if not HTML
          if (/\.(jpg|jpeg|png|gif|pdf|doc|docx|xml|json)$/i.test(urlObj.pathname)) {
            console.log(`[URLNormalization] Skipping non-HTML URL: ${normalizedUrl}`);
            return;
          }

          const pathPattern = urlObj.pathname.split('/')[1];
          if (pathPattern && !patterns.failed.has(pathPattern)) {
            queue.push(normalizedUrl);
            console.log(`[PageDiscovery] Queued URL: ${normalizedUrl} (pattern: ${pathPattern})`);
          }
        } catch (error) {
          console.log(`[URLNormalization] Error processing href: ${error}`);
        }
      });

      pageCount++;
      
      // Mark pattern as successful
      const pathPattern = new URL(url).pathname.split('/')[1];
      if (pathPattern) {
        patterns.successful.add(pathPattern);
        console.log(`[PatternLearning] Added successful pattern: ${pathPattern}`);
      }

    } catch (error: any) {
      const requestTime = Date.now() - requestStart;
      console.log(`[URLValidation] Error fetching ${url} after ${requestTime}ms:`, error);
      
      validationResults.set(url, {
        isValid: false,
        statusCode: error.response?.status,
        error: error.message,
        timing: requestTime
      });
      
      // Only mark as failed if we get a definitive error
      if (error.response?.status === 404) {
        const pathPattern = new URL(url).pathname.split('/')[1];
        if (pathPattern) {
          patterns.failed.add(pathPattern);
          console.log(`[PatternLearning] Added failed pattern: ${pathPattern}`);
        }
      }
    }

    // Add delay between requests based on timing
    const requestTime = Date.now() - requestStart;
    const dynamicDelay = Math.max(2000, requestTime * 2);
    console.log(`[RateLimit] Waiting ${dynamicDelay}ms before next request`);
    await delay(dynamicDelay);
  }

  // Log final statistics
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  console.log('\n[PageDiscovery] Final Statistics:', {
    patternsLearned: {
      successful: Array.from(patterns.successful),
      failed: Array.from(patterns.failed)
    },
    validationResults: Object.fromEntries(validationResults),
    totalPages: pageCount,
    totalTime,
    avgRequestTime: totalTime / requestCount
  });

  return pages;
}

// Enhanced scraping with better retry logic
async function scrapeWithRetry(url: string, attempt = 0): Promise<BusinessInfo> {
  const originalUrl = url;
  console.log(`\n[ScrapeWithRetry] Starting scrape for URL: ${url}`);
  
  // Clean up URL
  url = url.replace(/\/$/, ''); // Remove trailing slash
  if (url !== originalUrl) {
    console.log(`[ScrapeWithRetry] Cleaned URL: ${url}`);
  }

  try {
    await enforceRateLimit();
    
    // Try GET request first without HEAD validation
    console.log(`[ScrapeWithRetry] Attempting direct GET request to: ${url}`);
    try {
      const getResponse = await axios.get(url, {
        timeout: 5000,
        validateStatus: (status) => {
          console.log(`[ScrapeWithRetry] GET response status: ${status}`);
          return status === 200;
        }
      });
      
      if (getResponse.status === 200) {
        console.log(`[ScrapeWithRetry] Successful GET request to: ${url}`);
        return await scrapeUrl(url);
      }
    } catch (getError) {
      if (axios.isAxiosError(getError)) {
        console.log(`[ScrapeWithRetry] GET request failed with status: ${getError.response?.status}`);
        
        // If it's a 404, try with trailing slash
        if (getError.response?.status === 404 && !url.endsWith('/')) {
          const urlWithSlash = url + '/';
          console.log(`[ScrapeWithRetry] Trying URL with trailing slash: ${urlWithSlash}`);
          try {
            const slashResponse = await axios.get(urlWithSlash, { timeout: 5000 });
            if (slashResponse.status === 200) {
              console.log(`[ScrapeWithRetry] Successful GET request with trailing slash`);
              return await scrapeUrl(urlWithSlash);
            }
          } catch (slashError) {
            console.log(`[ScrapeWithRetry] Trailing slash attempt also failed`);
          }
        }
      }
      throw getError;
    }
    
    return await scrapeUrl(url);
  } catch (error) {
    const scrapeError = error as ScrapeError;
    
    // Log detailed error information
    console.log(`[ScrapeWithRetry] Error details:`, {
      message: scrapeError.message,
      status: scrapeError.response?.status,
      attempt: attempt
    });
    
    // Don't retry or log 404s as they're expected
    if (scrapeError.response?.status === 404) {
      console.log(`[ScrapeWithRetry] Page not found (404) for URL: ${url}`);
      throw new Error(`Page not found: ${url}`);
    }
    
    if (scrapeError.message.includes("Rate limit") && attempt < BACKOFF_DELAYS.length) {
      const waitTime = BACKOFF_DELAYS[attempt];
      console.log(`[ScrapeWithRetry] Rate limited. Retrying in ${waitTime/1000} seconds...`);
      await delay(waitTime);
      return scrapeWithRetry(url, attempt + 1);
    }
    
    // Don't retry on client errors
    if (scrapeError.response?.status && scrapeError.response.status >= 400 && scrapeError.response.status < 500) {
      console.log(`[ScrapeWithRetry] Client error ${scrapeError.response.status} for URL: ${url}`);
      throw new Error(`Client error: ${scrapeError.response.status}`);
    }
    
    // Retry on server errors or network issues
    if (attempt < BACKOFF_DELAYS.length) {
      const waitTime = BACKOFF_DELAYS[attempt];
      console.log(`[ScrapeWithRetry] Server/network error. Retrying in ${waitTime/1000} seconds...`);
      await delay(waitTime);
      return scrapeWithRetry(url, attempt + 1);
    }
    
    throw scrapeError;
  }
}

// Merge business info from multiple pages
function mergeBusinessInfo(target: BusinessInfo, source: BusinessInfo): BusinessInfo {
  return {
    ...target,
    ...source,
    teamMembers: [...(target.teamMembers || []), ...(source.teamMembers || [])],
    services: [...new Set([...(target.services || []), ...(source.services || [])])],
    specialties: [...new Set([...(target.specialties || []), ...(source.specialties || [])])],
    insurances: [...new Set([...(target.insurances || []), ...(source.insurances || [])])],
    affiliations: [...new Set([...(target.affiliations || []), ...(source.affiliations || [])])],
    scrapedPages: [...(target.scrapedPages || []), ...(source.scrapedPages || [])]
  };
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
    | 'business-found'
    | 'urlSkipped'
    | 'pagesDiscovered'
    | 'pageScraped'
    | 'pageError';
  data: any;
}

export type ProgressCallback = (data: {
  type: string
  message?: string
  data?: any
  error?: Error
}) => void

export type ErrorCallback = (error: Error) => void

export async function searchAndScrape(
  query: string,
  onProgress: ProgressCallback,
  onError: ErrorCallback
) {
  try {
    // Check quota first
    const quotaOk = await checkQuota();
    if (!quotaOk) {
      const error = new Error("Monthly quota exceeded");
      onProgress({
        type: "scrapeError",
        message: "Monthly quota exceeded",
        error
      });
      onError(error);
      return;
    }

    // Start search
    onProgress({
      type: "searchStart",
      message: "Starting search...",
      data: { query }
    });

    const searchResults = await searchBusinesses(query);

    onProgress({
      type: "searchComplete",
      message: "Search completed",
      data: {
        count: searchResults.length,
        results: searchResults
      }
    });

    // Process each result
    for (const result of searchResults) {
      try {
        // Check if URL was already processed
        const processed = await checkProcessedUrl(result.url);
        if (processed) {
          onProgress({
            type: "urlSkipped",
            message: "URL already processed",
            data: { url: result.url }
          });
          continue;
        }

        onProgress({
          type: "scrapeStart",
          message: "Starting scrape...",
          data: { url: result.url }
        });

        // Discover additional pages
        const pages = await discoverPages(result.url);
        
        onProgress({
          type: "pagesDiscovered",
          message: "Additional pages discovered",
          data: { pages: Object.fromEntries(pages) }
        });

        // Scrape main page
        let businessInfo = await scrapeWithRetry(result.url);

        // Scrape additional pages and merge info
        for (const [pageType, urls] of pages) {
          for (const url of urls) {
            try {
              const pageInfo = await scrapeWithRetry(url);
              businessInfo = mergeBusinessInfo(businessInfo, pageInfo);
              
              onProgress({
                type: "pageScraped",
                message: `Scraped ${pageType} page`,
                data: { url, pageType }
              });
            } catch (error: any) {
              onProgress({
                type: "pageError",
                message: `Failed to scrape ${pageType} page`,
                error,
                data: { url, pageType }
              });
            }
          }
        }

        // Create business profile
        const profile = await createBusinessProfile(
          result.url,
          businessInfo,
          result.url,
          "search"
        );

        if (profile.success) {
          onProgress({
            type: "scrapeComplete",
            message: "Scrape completed successfully",
            data: {
              url: result.url,
              profile: profile.data
            }
          });

          // Mark URL as processed
          await markUrlAsProcessed(result.url);
        } else {
          throw new Error(profile.message);
        }
      } catch (error: any) {
        // Handle rate limiting
        if (error.message.includes("Rate limit")) {
          onProgress({
            type: "scrapeError",
            message: "Rate limit exceeded",
            error
          });
          onError(error);
          continue;
        }

        // Handle other errors
        onProgress({
          type: "scrapeError",
          message: "Failed to scrape website",
          error
        });
        onError(error);
      }
    }
  } catch (error: any) {
    onProgress({
      type: "error",
      message: "Search and scrape failed",
      error
    });
    onError(error);
  }
}

export type { SearchAndScrapeResult, SearchAndScrapeProgress }; 