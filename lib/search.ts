import axios from 'axios';

// Mock search results for testing
const MOCK_SEARCH_RESULTS = [
  {
    url: "https://example-dentist.com",
    title: "Example Dental Practice",
    description: "A leading dental practice in Austin, Texas"
  }
]

// For testing purposes
let mockSearchFunction: ((query: string) => Promise<any[]>) | null = null

export function setSearchFunction(mock: typeof mockSearchFunction) {
  mockSearchFunction = mock
}

export interface SearchResult {
  url: string
  title: string
  description: string
}

export async function searchBusinesses(query: string): Promise<SearchResult[]> {
  try {
    // Use mock function if provided (for testing)
    if (mockSearchFunction) {
      return mockSearchFunction(query)
    }

    // Use Brave API for real searches
    const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      params: {
        q: query,
        result_filter: 'web'
      },
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': process.env.BRAVE_API_KEY
      }
    });

    if (response.data && response.data.web && response.data.web.results) {
      return response.data.web.results.map((r: any) => ({
        url: r.url,
        title: r.title,
        description: r.description
      }));
    }

    return [];
  } catch (error) {
    console.error("Error performing search:", error)
    throw error
  }
} 