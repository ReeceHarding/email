import axios from 'axios';
import { search } from '../../lib/search-service';
import '../setup-jest-types'; // Import custom jest type extensions

// Mock axios for integration tests
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Brave Search API - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set test environment variables
    process.env.BRAVE_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    // Clear environment variables
    delete process.env.BRAVE_API_KEY;
  });

  it('should process and return structured results from the API', async () => {
    // Simulate a more complex API response with multiple results
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        web: {
          results: [
            {
              url: 'https://example-dental.com',
              title: 'Example Dental Clinic - Dallas',
              description: 'Leading dental services in Dallas, Texas. Providing general dentistry, cosmetic procedures, and more.',
              deep_links: [
                { url: 'https://example-dental.com/services', title: 'Our Services' },
                { url: 'https://example-dental.com/team', title: 'Meet Our Team' }
              ],
              site_categories: ['Health', 'Dental']
            },
            {
              url: 'https://dallas-smiles.com',
              title: 'Dallas Smiles - Family Dentistry',
              description: 'Family dental care in Dallas with a focus on preventative dentistry and patient comfort.',
              deep_links: [
                { url: 'https://dallas-smiles.com/about', title: 'About Us' }
              ],
              site_categories: ['Health', 'Family Dental']
            }
          ],
        },
      },
    });

    const results = await search('dentists in dallas texas');
    
    // Verify we have multiple results
    expect(results).toHaveLength(2);
    
    // Check the structure and metadata of the first result
    expect(results[0]).toEqual(
      expect.objectContaining({
        url: 'https://example-dental.com',
        title: 'Example Dental Clinic - Dallas',
        description: expect.stringContaining('dental services in Dallas'),
        source: 'brave',
        metadata: expect.objectContaining({
          position: 1,
          query: 'dentists in dallas texas',
          deepLinks: expect.arrayContaining([
            expect.objectContaining({
              url: expect.stringContaining('/team'),
              title: 'Meet Our Team'
            })
          ]),
        }),
      })
    );

    // Check that the second result has different information
    expect(results[1].url).toBe('https://dallas-smiles.com');
    expect(results[1].title).toContain('Family Dentistry');
    expect(results[1].metadata?.siteCategories).toContain('Family Dental');
  });

  it('should handle empty search results gracefully', async () => {
    // Mock an empty results response
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        web: {
          results: [],
        },
      },
    });

    // Mock the fallback to ensure at least one result
    mockedAxios.head.mockResolvedValueOnce({ status: 200 });

    const results = await search('extremely unlikely search query');
    
    // Verify the fallback was used and returned at least one result
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('domain-guess');
  });

  it('should process and normalize results from different sources', async () => {
    // First request fails
    mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));
    
    // Mock a successful head request for the fallback
    mockedAxios.head.mockResolvedValueOnce({ status: 200 });

    const results = await search('dentists in dallas');
    
    // Verify we have fallback results
    expect(results.length).toBeGreaterThan(0);
    
    // Check that the URLs are properly formatted
    results.forEach(result => {
      expect(result.url).toMatch(/^https?:\/\//);
      expect(result.title.length).toBeGreaterThan(0);
      expect(result.description.length).toBeGreaterThan(0);
    });
  });
}); 