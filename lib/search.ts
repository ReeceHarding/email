import axios from 'axios';
import { decrementQuota } from './search-utils';

const BRAVE_API_KEY = process.env.BRAVE_API_KEY!;

interface SearchResult {
  url: string;
  title: string;
}

type ProgressCallback = (event: string, payload: any) => void;

// For testing purposes
let mockSearchFunction: ((query: string, onProgress?: (type: string, data: any) => void) => Promise<any[]>) | null = null

export function setSearchFunction(mock: typeof mockSearchFunction) {
  mockSearchFunction = mock
}

export async function searchBusinesses(
  query: string,
  onProgress?: ProgressCallback
): Promise<SearchResult[]> {
  if (mockSearchFunction) {
    return mockSearchFunction(query, onProgress)
  }
  try {
    onProgress?.('searchStart', { query });

    const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': BRAVE_API_KEY
      },
      params: {
        q: query,
        result_filter: 'web'
      }
    });

    decrementQuota();

    const results: SearchResult[] = response.data.web.results.map((result: any) => ({
      url: result.url,
      title: result.title
    }));

    // Filter out social media and review sites
    const filteredResults = results.filter(result => {
      const url = result.url.toLowerCase();
      return !url.includes('facebook.com') &&
        !url.includes('yelp.com') &&
        !url.includes('healthgrades.com') &&
        !url.includes('ratemds.com') &&
        !url.includes('youtube.com') &&
        !url.includes('instagram.com') &&
        !url.includes('twitter.com') &&
        !url.includes('linkedin.com');
    });

    onProgress?.('searchComplete', {
      query,
      count: filteredResults.length,
      results: filteredResults
    });

    return filteredResults;
  } catch (error) {
    console.error('[SEARCH] Error searching businesses:', error);
    if (error instanceof Error) {
      console.error('[SEARCH] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    throw error;
  }
} 