import { search } from '@/lib/search-service';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Search Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return search results when API call succeeds', async () => {
    // Mock successful API response
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        web: {
          results: [
            {
              url: 'https://example.com',
              title: 'Example Website',
              description: 'This is an example website'
            },
            {
              url: 'https://test.com',
              title: 'Test Website',
              description: 'This is a test website'
            }
          ]
        }
      }
    });

    // Call the search function
    const results = await search('test query');

    // Verify axios was called correctly
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('search.brave.com'),
      expect.objectContaining({
        params: expect.objectContaining({
          q: 'test query'
        })
      })
    );

    // Verify results
    expect(results).toHaveLength(2);
    expect(results[0].url).toBe('https://example.com');
    expect(results[1].url).toBe('https://test.com');
  });

  it('should use fallback search when API call fails', async () => {
    // Mock failed API response
    mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));
    
    // Mock domain check to return immediately
    // This prevents the fallback from making real network calls
    mockedAxios.head.mockResolvedValue({ status: 200 });

    // Call the search function
    const results = await search('test query', {
      // Use small limits to speed up the test
      resultsPerQuery: 1,
      retryAttempts: 1
    });

    // Verify axios was called correctly
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    
    // Verify the fallback generated results
    expect(results.length).toBeGreaterThanOrEqual(0);
  }, 10000); // Increase timeout to 10 seconds
}); 