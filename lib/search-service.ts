import axios from 'axios';
import { delay } from './utils';
import "dotenv/config";

// Configuration Constants
const BRAVE_API_KEY = process.env.BRAVE_API_KEY || "";
const SEARCH_RETRY_ATTEMPTS = 3;
const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";
const MAX_RESULTS_PER_QUERY = 15;
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay between requests to avoid rate limiting

// Request headers
const BRAVE_HEADERS = {
  "Accept": "application/json",
  "Accept-Encoding": "gzip",
  "X-Subscription-Token": BRAVE_API_KEY
};

export interface SearchResult {
  url: string;
  title: string;
  description: string;
  source: "brave" | "fallback" | "domain-guess";
  metadata?: {
    position?: number;
    query?: string;
    [key: string]: any;
  };
}

interface SearchOptions {
  resultsPerQuery?: number;
  safeSearch?: boolean;
  country?: string;
  retryAttempts?: number;
}

/**
 * Performs a search using the Brave Search API
 */
export async function search(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    resultsPerQuery = MAX_RESULTS_PER_QUERY,
    safeSearch = true,
    country = "US",
    retryAttempts = SEARCH_RETRY_ATTEMPTS
  } = options;

  console.log(`[SearchService] Searching for: "${query}"`);

  // Validate API key
  if (!BRAVE_API_KEY) {
    console.warn("[SearchService] No Brave API key found. Using fallback search.");
    return await fallbackSearch(query, options);
  }

  let attempt = 0;
  let error: any = null;

  while (attempt < retryAttempts) {
    try {
      const response = await axios.get(BRAVE_SEARCH_URL, {
        params: {
          q: query,
          result_filter: "web",
          count: resultsPerQuery,
          search_lang: "en",
          country: country,
          safe_search: safeSearch ? 1 : 0
        },
        headers: BRAVE_HEADERS,
        timeout: 10000 // 10 second timeout
      });

      // Log request details for debugging
      console.log(`[SearchService] Brave search response status: ${response.status}`);

      // Check if we have valid results
      if (response.data?.web?.results?.length > 0) {
        const results = response.data.web.results.map((item: any, index: number) => ({
          url: item.url,
          title: item.title,
          description: item.description,
          source: "brave" as const,
          metadata: {
            position: index + 1,
            query: query,
            deepLinks: item.deep_links || [],
            siteCategories: item.site_categories || []
          }
        }));

        console.log(`[SearchService] Found ${results.length} results for query: "${query}"`);
        return results;
      } else {
        console.warn(`[SearchService] No results found in Brave API response for: "${query}"`);
        error = new Error("No results found");
      }
    } catch (err: any) {
      error = err;
      console.error(`[SearchService] Error searching Brave (attempt ${attempt + 1}):`, {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data
      });
    }

    // Increase delay with each retry
    await delay((attempt + 1) * DELAY_BETWEEN_REQUESTS);
    attempt++;
  }

  console.log(`[SearchService] All ${retryAttempts} attempts failed. Using fallback search.`);
  return await fallbackSearch(query, options);
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
  
  const { resultsPerQuery = MAX_RESULTS_PER_QUERY } = options;
  const results: SearchResult[] = [];

  // Try to extract business type and location from query
  const parts = query.toLowerCase().split(/\s+in\s+|\s+near\s+|\s+at\s+/);
  const businessType = parts[0].trim();
  const location = parts[1]?.trim() || "";
  
  // Generate domain variations
  const variations = generateDomainVariations(businessType, location);
  
  console.log(`[SearchService] Generated ${variations.length} domain variations`);
  
  // Check each domain variation
  for (const domain of variations) {
    if (results.length >= resultsPerQuery) break;
    
    try {
      const isValid = await isValidDomain(domain.url);
      
      if (isValid) {
        console.log(`[SearchService] Valid domain found: ${domain.url}`);
        results.push({
          url: domain.url,
          title: domain.title,
          description: domain.description,
          source: "domain-guess",
          metadata: {
            query: query,
            basePattern: domain.basePattern
          }
        });
      }
    } catch (error) {
      // Ignore errors for individual domain checks
    }
    
    // Small delay to avoid overwhelming servers
    await delay(200);
  }

  console.log(`[SearchService] Fallback search found ${results.length} results`);
  return results;
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

/**
 * Generates domain variations based on business type and location
 */
function generateDomainVariations(businessType: string, location: string): Array<{
  url: string;
  title: string;
  description: string;
  basePattern: string;
}> {
  // Normalize inputs
  const normalizedBusiness = businessType.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const normalizedLocation = location ? location.replace(/[^a-z0-9]/gi, "-").toLowerCase() : "";
  
  // Base patterns
  const patterns = [
    { pattern: `${normalizedBusiness}`, type: "business-only" },
    { pattern: `${normalizedBusiness}-${normalizedLocation}`, type: "business-location" },
    { pattern: `${normalizedLocation}-${normalizedBusiness}`, type: "location-business" },
    { pattern: `${normalizedBusiness}${normalizedLocation}`, type: "combined" },
    { pattern: `the-${normalizedBusiness}`, type: "the-prefix" },
    { pattern: `best-${normalizedBusiness}`, type: "best-prefix" },
    { pattern: `${normalizedBusiness}-services`, type: "services-suffix" },
    { pattern: `${normalizedBusiness}-solutions`, type: "solutions-suffix" },
    { pattern: `${normalizedBusiness}s`, type: "plural" },
    { pattern: `${normalizedLocation}${normalizedBusiness}s`, type: "location-plural" }
  ];
  
  // Domain TLDs to try
  const tlds = [".com", ".net", ".org", ".co", ".io", ".us", ".biz"];
  
  // Prefixes
  const prefixes = ["www.", ""];
  
  // Generate all combinations
  const variations: Array<{
    url: string;
    title: string;
    description: string;
    basePattern: string;
  }> = [];
  
  for (const { pattern, type } of patterns) {
    // Skip empty patterns
    if (!pattern) continue;
    
    for (const tld of tlds) {
      for (const prefix of prefixes) {
        const domain = `${prefix}${pattern}${tld}`;
        const url = `https://${domain}`;
        
        // Generate a title and description based on the pattern
        const title = generateTitle(pattern, businessType, location);
        const description = generateDescription(pattern, businessType, location);
        
        variations.push({
          url,
          title,
          description,
          basePattern: type
        });
      }
    }
  }

  return variations;
}

/**
 * Generate a title for a domain variation
 */
function generateTitle(
  pattern: string, 
  businessType: string, 
  location: string
): string {
  // Convert dash notation to spaces and capitalize words
  const formatted = pattern
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  
  if (location) {
    return `${formatted} - ${businessType.charAt(0).toUpperCase() + businessType.slice(1)} in ${location.charAt(0).toUpperCase() + location.slice(1)}`;
  }
  
  return formatted;
}

/**
 * Generate a description for a domain variation
 */
function generateDescription(
  pattern: string,
  businessType: string,
  location: string
): string {
  const businessFormatted = businessType.charAt(0).toUpperCase() + businessType.slice(1);
  
  if (location) {
    const locationFormatted = location.charAt(0).toUpperCase() + location.slice(1);
    return `${businessFormatted} services in ${locationFormatted}. Find information about our services, team, and contact details.`;
  }
  
  return `${businessFormatted} services. Find information about our services, team, and contact details.`;
} 