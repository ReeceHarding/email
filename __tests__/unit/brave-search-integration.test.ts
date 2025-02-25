import axios from 'axios';
import * as searchService from '../../lib/search-service';
import '../setup-jest-types'; // Import custom jest type extensions

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock utils delay function to avoid actual delays in tests
jest.mock('../../lib/utils', () => ({
  delay: jest.fn().mockResolvedValue(undefined),
}));

// Mock the BRAVE_API_KEY to ensure tests are self-contained
jest.mock('../../lib/search-service', () => {
  const originalModule = jest.requireActual('../../lib/search-service');
  return {
    ...originalModule,
    __esModule: true,
  };
});

describe('Brave Search API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set test environment variables
    process.env.BRAVE_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    // Clear environment variables
    delete process.env.BRAVE_API_KEY;
  });

  it('should initialize correctly with valid API key', async () => {
    // Mock successful response
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        web: {
          results: [
            {
              url: 'https://example.com',
              title: 'Example Website',
              description: 'This is an example website',
            },
          ],
        },
      },
    });

    const results = await searchService.search('test query');
    
    // Verify the request was made with correct parameters
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          q: 'test query',
        }),
      })
    );
    
    // Verify the results are correctly processed
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(
      expect.objectContaining({
        url: 'https://example.com',
        title: 'Example Website',
        source: 'brave',
      })
    );
  });

  it('should handle missing API key by using fallback search', async () => {
    // Make a separate test for this specific case
    jest.isolateModules(async () => {
      // Ensure API key is undefined for this test
      process.env.BRAVE_API_KEY = '';
      
      // Reset the mock to clear previous calls
      mockedAxios.get.mockReset();
      
      // Mock successful fallback domain check
      mockedAxios.head.mockResolvedValue({ status: 200 });

      const { search } = require('../../lib/search-service');
      const results = await search('dentists in dallas');
      
      // Verify Brave Search API was not called
      expect(mockedAxios.get).not.toHaveBeenCalled();
      
      // Verify the fallback search was used and returned results
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toEqual(
        expect.objectContaining({
          source: 'domain-guess',
        })
      );
    });
  }, 15000); // Increase timeout for this test

  it('should handle API errors with retry logic', async () => {
    // Mock failure on first attempt, success on second
    mockedAxios.get
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce({
        status: 200,
        data: {
          web: {
            results: [
              {
                url: 'https://example.com',
                title: 'Example Website',
                description: 'This is an example website',
              },
            ],
          },
        },
      });

    const results = await searchService.search('test query');
    
    // Verify the request was attempted twice
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    
    // Verify the results from the second attempt are returned
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://example.com');
  });
}); 