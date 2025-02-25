import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { delay } from './utils';
import "dotenv/config";
import { 
  processBraveSearchResults, 
  createFallbackSearchResults, 
  deduplicateAndValidateResults, 
  rankSearchResults 
} from './search-result-processor';

// Configuration Constants
const BRAVE_API_KEY = process.env.BRAVE_API_KEY || "";
const SEARCH_RETRY_ATTEMPTS = 3;
const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";
const MAX_RESULTS_PER_QUERY = 15;
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay between requests to avoid rate limiting
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const MAX_REQUESTS_PER_MINUTE = 10; // Rate limit for Brave Search API
const MAX_BACKOFF_DELAY = 30000; // 30 seconds maximum backoff

// Request headers
const BRAVE_HEADERS = {
  "Accept": "application/json",
  "Accept-Encoding": "gzip",
  "X-Subscription-Token": BRAVE_API_KEY
};

// Error types
export enum SearchErrorType {
  MISSING_API_KEY = 'missing_api_key',
  RATE_LIMITED = 'rate_limited',
  TIMEOUT = 'timeout',
  NETWORK_ERROR = 'network_error',
  API_ERROR = 'api_error',
  INVALID_RESPONSE = 'invalid_response',
  UNKNOWN_ERROR = 'unknown_error'
}

export class SearchError extends Error {
  type: SearchErrorType;
  status?: number;
  retryAfter?: number;
  
  constructor(message: string, type: SearchErrorType, status?: number, retryAfter?: number) {
    super(message);
    this.name = 'SearchError';
    this.type = type;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

// Rate limiting implementation
let requestsThisMinute = 0;
let minuteStartTime = Date.now();

// Reset the request counter every minute
function updateRateLimitCounter() {
  const now = Date.now();
  if (now - minuteStartTime > 60000) {
    requestsThisMinute = 0;
    minuteStartTime = now;
  }
}

// Check if we can make a request without hitting rate limits
function canMakeRequest(): boolean {
  updateRateLimitCounter();
  return requestsThisMinute < MAX_REQUESTS_PER_MINUTE;
}

// Increment the request counter
function trackRequest() {
  updateRateLimitCounter();
  requestsThisMinute++;
}

// Calculate backoff delay based on attempt number and rate limit information
function calculateBackoff(attempt: number, retryAfter?: number): number {
  if (retryAfter) {
    return Math.min(retryAfter * 1000, MAX_BACKOFF_DELAY);
  }
  
  // Exponential backoff: 1s, 2s, 4s, 8s, etc.
  const backoff = DELAY_BETWEEN_REQUESTS * Math.pow(2, attempt);
  return Math.min(backoff, MAX_BACKOFF_DELAY);
}

/**
 * Interface for standardized search result object
 */
export interface SearchResult {
  url: string;
  title: string;
  description: string;
  source: 'brave' | 'brave-search' | 'fallback' | 'domain-guess';
  metadata?: {
    position?: number;
    query?: string;
    deepLinks?: Array<{
      url: string;
      title: string;
    }>;
    extraData?: string[];
    siteCategories?: string[];
    language?: string;
    favicon?: string | null;
    isGenerated?: boolean;
  };
}

export interface SearchOptions {
  resultsPerQuery?: number;
  safeSearch?: boolean;
  country?: string;
  retryAttempts?: number;
  timeout?: number;
  freshness?: 'day' | 'week' | 'month' | 'year' | 'any';
  searchRegion?: string;
}

export interface BraveSearchStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  averageResponseTime: number;
  lastRequestTime: number | null;
}

// Search statistics tracking
let searchStats: BraveSearchStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  rateLimitedRequests: 0,
  averageResponseTime: 0,
  lastRequestTime: null
};

/**
 * Get current search API statistics
 */
export function getSearchStats(): BraveSearchStats {
  return { ...searchStats };
}

/**
 * Reset search statistics
 */
export function resetSearchStats(): void {
  searchStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rateLimitedRequests: 0,
    averageResponseTime: 0,
    lastRequestTime: null
  };
}

/**
 * Validates search options and applies defaults
 */
function validateAndApplyDefaults(options?: SearchOptions): SearchOptions {
  const validatedOptions: SearchOptions = {
    resultsPerQuery: options?.resultsPerQuery || MAX_RESULTS_PER_QUERY,
    safeSearch: options?.safeSearch !== undefined ? options.safeSearch : true,
    country: options?.country || 'US',
    retryAttempts: options?.retryAttempts || SEARCH_RETRY_ATTEMPTS,
    timeout: options?.timeout || DEFAULT_TIMEOUT,
    freshness: options?.freshness || 'any',
    searchRegion: options?.searchRegion || 'us'
  };
  
  // Ensure resultsPerQuery is within reasonable limits
  if (validatedOptions.resultsPerQuery! < 1) {
    validatedOptions.resultsPerQuery = 1;
  } else if (validatedOptions.resultsPerQuery! > 100) {
    validatedOptions.resultsPerQuery = 100;
  }
  
  return validatedOptions;
}

/**
 * Performs a search using the Brave Search API with enhanced error handling,
 * rate limiting, and retries.
 */
export async function search(
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  // Validate input
  if (!query || query.trim() === '') {
    throw new SearchError('Search query cannot be empty', SearchErrorType.INVALID_RESPONSE);
  }
  
  const validatedOptions = validateAndApplyDefaults(options);
  
  console.log(`[SearchService] Searching for: "${query}"`);
  
  // Start tracking metrics
  const startTime = Date.now();
  searchStats.totalRequests++;
  searchStats.lastRequestTime = startTime;

  // Validate API key
  if (!BRAVE_API_KEY) {
    console.warn("[SearchService] No Brave API key found. Using fallback search.");
    searchStats.failedRequests++;
    return await fallbackSearch(query, validatedOptions);
  }

  let attempt = 0;
  let lastError: SearchError | null = null;

  while (attempt < validatedOptions.retryAttempts!) {
    try {
      // Check rate limits
      if (!canMakeRequest()) {
        const waitTime = calculateBackoff(attempt);
        console.warn(`[SearchService] Rate limit reached. Waiting ${waitTime}ms before retry.`);
        await delay(waitTime);
        // Check again after waiting
        if (!canMakeRequest()) {
          searchStats.rateLimitedRequests++;
          throw new SearchError(
            'Rate limit exceeded',
            SearchErrorType.RATE_LIMITED,
            429,
            60 // Default to waiting 60 seconds
          );
        }
      }
      
      // Track request for rate limiting
      trackRequest();
      
      // Configure request parameters
      const params: Record<string, any> = {
        q: query,
        result_filter: "web",
        count: validatedOptions.resultsPerQuery,
        search_lang: "en",
        country: validatedOptions.country,
        safe_search: validatedOptions.safeSearch ? 1 : 0
      };
      
      // Add optional parameters if specified
      if (validatedOptions.freshness && validatedOptions.freshness !== 'any') {
        params.freshness = validatedOptions.freshness;
      }
      
      if (validatedOptions.searchRegion) {
        params.search_region = validatedOptions.searchRegion;
      }
      
      // Configure the request
      const config: AxiosRequestConfig = {
        params,
        headers: BRAVE_HEADERS,
        timeout: validatedOptions.timeout
      };

      // Execute the request
      const response = await axios.get(BRAVE_SEARCH_URL, config);
      
      // Update metrics for successful request
      const responseTime = Date.now() - startTime;
      searchStats.averageResponseTime = 
        (searchStats.averageResponseTime * searchStats.successfulRequests + responseTime) / 
        (searchStats.successfulRequests + 1);
      searchStats.successfulRequests++;

      // Log request details for debugging
      console.log(`[SearchService] Brave search response status: ${response.status} (${responseTime}ms)`);

      // Process search results using our dedicated processor
      const results = processBraveSearchResults(response.data, query);
      
      if (results.length > 0) {
        console.log(`[SearchService] Found ${results.length} results for query: "${query}"`);
        return deduplicateAndValidateResults(results);
      } else {
        console.warn(`[SearchService] No results found in Brave API response for: "${query}"`);
        lastError = new SearchError(
          'No results found',
          SearchErrorType.INVALID_RESPONSE
        );
      }
    } catch (err: any) {
      const error = err as Error | AxiosError;
      
      // Update metrics for failed request
      searchStats.failedRequests++;
      
      // Determine error type
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        
        if (status === 429) {
          // Rate limit error
          const retryAfter = parseInt(error.response?.headers['retry-after'] || '60', 10);
          lastError = new SearchError(
            `Rate limit exceeded: ${error.message}`, 
            SearchErrorType.RATE_LIMITED,
            status,
            retryAfter
          );
          searchStats.rateLimitedRequests++;
        } else if (error.code === 'ECONNABORTED') {
          // Timeout error
          lastError = new SearchError(
            `Request timeout: ${error.message}`,
            SearchErrorType.TIMEOUT
          );
        } else if (!error.response) {
          // Network error
          lastError = new SearchError(
            `Network error: ${error.message}`,
            SearchErrorType.NETWORK_ERROR
          );
        } else {
          // Other API error
          lastError = new SearchError(
            `API error: ${error.message}`,
            SearchErrorType.API_ERROR,
            status
          );
        }
      } else {
        // Unknown error
        lastError = new SearchError(
          `Unknown error: ${error.message || 'No error message available'}`,
          SearchErrorType.UNKNOWN_ERROR
        );
      }
      
      // Safely log error details without accessing potentially undefined properties
      console.error(`[SearchService] Error searching Brave (attempt ${attempt + 1}):`, {
        type: lastError.type,
        message: lastError.message,
        status: lastError.status || 'N/A'
      });
    }

    // Calculate delay with exponential backoff based on the attempt number
    const backoffDelay = calculateBackoff(attempt, lastError?.retryAfter);
    console.log(`[SearchService] Retrying in ${backoffDelay}ms (attempt ${attempt + 1}/${validatedOptions.retryAttempts})`);
    await delay(backoffDelay);
    attempt++;
  }

  console.log(`[SearchService] All ${validatedOptions.retryAttempts} attempts failed. Using fallback search.`);
  return await fallbackSearch(query, validatedOptions);
}

/**
 * Fallback search method when Brave Search API fails
 * Uses domain guessing based on the query and direct URL construction
 */
async function fallbackSearch(
  query: string, 
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  console.log(`[SearchService] Using fallback search for: "${query}"`);
  
  // Use our dedicated fallback search result creator
  const results = createFallbackSearchResults(query);
  
  // Check each domain for validity
  const validResults: SearchResult[] = [];
  
  for (const result of results) {
    if (validResults.length >= (options.resultsPerQuery || MAX_RESULTS_PER_QUERY)) break;
    
    try {
      const isValid = await isValidDomain(result.url);
      
      if (isValid) {
        console.log(`[SearchService] Valid domain found: ${result.url}`);
        validResults.push(result);
      }
    } catch (error) {
      // Ignore errors for individual domain checks
    }
    
    // Small delay to avoid overwhelming servers
    await delay(200);
  }

  console.log(`[SearchService] Fallback search found ${validResults.length} results`);
  
  // Rank and return valid results
  return rankSearchResults(validResults, query);
}

/**
 * Checks if a domain is valid and exists
 */
async function isValidDomain(url: string): Promise<boolean> {
  try {
    const response = await axios.head(url, {
      timeout: 5000,
      maxRedirects: 2,
      validateStatus: (status) => status < 400
    });
    return true;
  } catch (error) {
    return false;
  }
} 