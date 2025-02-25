import { SearchResult } from './search-service';
import { BraveSearchResponse, BraveWebResult, BraveDeepLink } from './types/brave-search-types';

/**
 * Processes raw Brave Search API responses into standardized SearchResult objects
 */
export function processBraveSearchResults(
  response: BraveSearchResponse,
  query: string
): SearchResult[] {
  try {
    if (!response.web || !response.web.results || !Array.isArray(response.web.results)) {
      console.warn('[SearchProcessor] Invalid Brave Search response format', { query });
      return [];
    }

    return response.web.results.map((result: BraveWebResult, index: number) => 
      convertBraveResultToSearchResult(result, query, index + 1)
    );
  } catch (error) {
    console.error('[SearchProcessor] Error processing Brave search results', { error, query });
    return [];
  }
}

/**
 * Converts a single Brave search result to our standard SearchResult format
 */
function convertBraveResultToSearchResult(
  result: BraveWebResult,
  query: string,
  position: number
): SearchResult {
  // Ensure we have a valid URL
  if (!result.url) {
    console.warn('[SearchProcessor] Search result missing URL', { query, result });
    throw new Error('Invalid search result: missing URL');
  }

  // Extract deepLinks if available
  const deepLinks = result.deep_links?.map((link: BraveDeepLink) => ({
    url: link.url,
    title: link.title
  })) || [];

  // Extract extra snippets if available
  const extraData = result.extra_snippets || [];

  // Create the standard search result
  return {
    url: normalizeUrl(result.url),
    title: result.title || extractTitleFromUrl(result.url),
    description: result.description || '',
    source: 'brave',
    metadata: {
      position,
      query,
      deepLinks,
      extraData,
      siteCategories: result.site_categories || [],
      language: result.language,
      favicon: result.favicon || null
    }
  };
}

/**
 * Creates search results from domain guesses when the API fails
 */
export function createFallbackSearchResults(query: string): SearchResult[] {
  // Generate domain guesses based on the query
  const domains = generateDomainGuesses(query);
  
  return domains.map((domain, index) => ({
    url: domain,
    title: generateTitleFromDomain(domain),
    description: `Generated result for "${query}"`,
    source: 'domain-guess',
    metadata: {
      position: index + 1,
      query,
      isGenerated: true
    }
  }));
}

/**
 * Normalizes URLs to ensure consistent format
 */
function normalizeUrl(url: string): string {
  try {
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const urlObj = new URL(url);
    
    // Remove trailing slash from hostname only
    if (urlObj.pathname === '/' && urlObj.search === '') {
      return urlObj.href.replace(/\/$/, '');
    }
    
    return urlObj.href;
  } catch (error) {
    // If URL parsing fails, return the original with https prepended if needed
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return 'https://' + url;
    }
    return url;
  }
}

/**
 * Extracts a title from a URL when a title is not provided
 */
function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Remove www. prefix if present
    let hostname = urlObj.hostname.replace(/^www\./, '');
    
    // Remove TLD
    hostname = hostname.replace(/\.[^.]+$/, '');
    
    // Convert to title case and replace hyphens and underscores with spaces
    return hostname
      .split(/[-_.]/g)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } catch (error) {
    // Fallback for invalid URLs
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\.[^.]+$/, '');
  }
}

/**
 * Generates domain guesses based on a search query
 */
function generateDomainGuesses(query: string): string[] {
  // Clean up the query to make it suitable for domain generation
  const cleanQuery = query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars except spaces and hyphens
    .trim();
  
  // Generate variations for domains
  const words = cleanQuery.split(/\s+/);
  const tlds = ['.com', '.org', '.net', '.io'];
  const domains: string[] = [];
  
  // Basic domain from all words
  const basicDomain = words.join('') + tlds[0];
  domains.push(`https://www.${basicDomain}`);
  
  // Domain with hyphens between words
  const hyphenDomain = words.join('-') + tlds[0];
  domains.push(`https://www.${hyphenDomain}`);
  
  // Try different TLDs for the main variations
  for (let i = 1; i < tlds.length; i++) {
    domains.push(`https://www.${words.join('')}${tlds[i]}`);
  }
  
  // Add industry-specific domains for certain keywords
  if (cleanQuery.includes('dentist') || cleanQuery.includes('dental')) {
    domains.push(`https://www.${words[0]}dentist.com`);
    domains.push(`https://www.${words[0]}dental.com`);
  }
  
  if (cleanQuery.includes('doctor') || cleanQuery.includes('medical') || cleanQuery.includes('health')) {
    domains.push(`https://www.${words[0]}health.com`);
    domains.push(`https://www.${words[0]}medical.com`);
  }
  
  if (cleanQuery.includes('lawyer') || cleanQuery.includes('attorney') || cleanQuery.includes('legal')) {
    domains.push(`https://www.${words[0]}legal.com`);
    domains.push(`https://www.${words[0]}law.com`);
  }
  
  // Remove duplicates and return
  return [...new Set(domains)];
}

/**
 * Generates a title from a domain
 */
function generateTitleFromDomain(domain: string): string {
  try {
    const urlObj = new URL(domain);
    
    // Remove protocol, www, and TLD
    let name = urlObj.hostname
      .replace(/^www\./, '')
      .replace(/\.[^.]+$/, '');
    
    // Replace hyphens and underscores with spaces and capitalize
    name = name
      .split(/[-_.]/g)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Add general business suffix if short
    if (name.split(' ').length === 1) {
      const businessTypes = [
        'Inc',
        'LLC',
        'Company',
        'Group',
        'Services',
        'Solutions'
      ];
      return `${name} ${businessTypes[Math.floor(Math.random() * businessTypes.length)]}`;
    }
    
    return name;
  } catch (error) {
    // Fallback if URL parsing fails
    return domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\.[^.]+$/, '');
  }
}

/**
 * Removes duplicate results and ensures all results are valid
 */
export function deduplicateAndValidateResults(results: SearchResult[]): SearchResult[] {
  const seenUrls = new Set<string>();
  return results.filter(result => {
    // Skip if invalid URL
    if (!result.url) return false;
    
    try {
      // Normalize URL for deduplication
      const normalizedUrl = normalizeUrl(result.url);
      
      // Skip duplicates
      if (seenUrls.has(normalizedUrl)) return false;
      
      seenUrls.add(normalizedUrl);
      return true;
    } catch (error) {
      return false;
    }
  });
}

/**
 * Ranks search results based on relevance factors
 */
export function rankSearchResults(results: SearchResult[], query: string): SearchResult[] {
  // Score each result
  const scoredResults = results.map(result => {
    let score = 0;
    
    // Prefer results from the actual search API
    if (result.source === 'brave') {
      score += 1000;
    }
    
    // Favor results with higher positions from the API
    if (result.metadata?.position) {
      score += 500 / (result.metadata.position);
    }
    
    // Boost results with query terms in the URL
    const queryTerms = query.toLowerCase().split(/\s+/);
    const urlLower = result.url.toLowerCase();
    
    queryTerms.forEach(term => {
      if (urlLower.includes(term)) score += 50;
    });
    
    // Boost results with more complete information
    if (result.title && result.title.length > 0) score += 20;
    if (result.description && result.description.length > 0) score += 20;
    if (result.metadata?.deepLinks && result.metadata.deepLinks.length > 0) {
      score += result.metadata.deepLinks.length * 5;
    }
    
    return { result, score };
  });
  
  // Sort by score in descending order
  scoredResults.sort((a, b) => b.score - a.score);
  
  // Return the sorted results
  return scoredResults.map(item => item.result);
} 