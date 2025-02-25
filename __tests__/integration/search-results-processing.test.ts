import axios from 'axios';
import { search, SearchResult } from '../../lib/search-service';
import '../setup-jest-types'; // Import custom jest type extensions

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock utils delay function to avoid actual delays in tests
jest.mock('../../lib/utils', () => ({
  delay: jest.fn().mockResolvedValue(undefined),
}));

describe('Search Results Processing - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set test environment variables
    process.env.BRAVE_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    // Clear environment variables
    delete process.env.BRAVE_API_KEY;
  });

  it('should process diverse result types from Brave Search API', async () => {
    // Mock a complex search response with various result types
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        web: {
          results: [
            {
              url: 'https://example-dentists.com',
              title: 'Example Dental Clinic - Professional Care',
              description: 'Leading dental services in the area. Visit our modern facilities today.',
              deep_links: [
                { url: 'https://example-dentists.com/services', title: 'Dental Services' },
                { url: 'https://example-dentists.com/team', title: 'Our Team' }
              ],
              site_categories: ['Health', 'Dental'],
              language: 'en'
            },
            {
              url: 'https://dental-professionals.org',
              title: 'Dental Professionals Association',
              description: 'Professional association for dentists and dental specialists.',
              site_categories: ['Organization', 'Dental'],
              language: 'en',
              extra_snippets: ['Founded in 1985', 'Over 10,000 members']
            },
            {
              url: 'https://dentalreviews.com/dallas-best',
              title: 'Top 10 Dentists in Dallas',
              description: 'Comprehensive guide to the best dental practices in Dallas, Texas.',
              language: 'en'
            }
          ],
        },
      },
    });

    const results = await search('dentists dallas');
    
    // Verify we have the expected number of results
    expect(results).toHaveLength(3);
    
    // Check that all required fields are present in all results
    results.forEach(result => {
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('metadata');
    });
    
    // Verify metadata from the first result
    expect(results[0].metadata).toEqual(
      expect.objectContaining({
        position: 1,
        query: 'dentists dallas',
        deepLinks: expect.arrayContaining([
          expect.objectContaining({
            url: expect.stringContaining('/team'),
            title: 'Our Team'
          })
        ]),
        siteCategories: expect.arrayContaining(['Health', 'Dental']),
        language: 'en'
      })
    );
    
    // Verify the second result has extraData
    expect(results[1].metadata?.extraData).toEqual(
      expect.arrayContaining(['Founded in 1985', 'Over 10,000 members'])
    );
  });

  it('should handle missing fields gracefully', async () => {
    // Mock a response with missing fields
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        web: {
          results: [
            {
              url: 'https://example.com',
              title: 'Example Site',
              // Missing description
            },
            {
              url: 'https://another-example.com',
              // Missing title
              description: 'Another example site'
            }
          ],
        },
      },
    });

    const results = await search('test query');
    
    // Check that empty strings are provided for missing fields
    expect(results[0].description).toBe('');
    expect(results[1].title).toBeTruthy(); // Title should be derived from URL if missing
    
    // All results should have default metadata
    results.forEach(result => {
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.query).toBe('test query');
    });
  });

  it('should normalize and deduplicate results from different sources', async () => {
    // First call fails, forcing fallback
    mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));
    
    // Mock successful head requests for fallback
    mockedAxios.head.mockResolvedValue({ status: 200 });

    const results = await search('dentists');
    
    // Check that URLs are properly formatted
    results.forEach(result => {
      expect(result.url).toMatch(/^https?:\/\//);
      expect(result.source).toBe('domain-guess');
      
      // Titles and descriptions should be generated
      expect(result.title.length).toBeGreaterThan(0);
      expect(result.description.length).toBeGreaterThan(0);
    });
    
    // Check for duplicate URLs
    const urls = results.map(r => r.url);
    const uniqueUrls = new Set(urls);
    expect(uniqueUrls.size).toBe(urls.length); // All URLs should be unique
  });

  it('should handle empty search results gracefully', async () => {
    // Mock an empty results response
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        web: {
          results: [], // No results
        },
      },
    });
    
    // Mock fallback to ensure we get at least some results
    mockedAxios.head.mockResolvedValue({ status: 200 });

    const results = await search('extremely rare query');
    
    // Should fall back to domain guessing
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('domain-guess');
  });
}); 