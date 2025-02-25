/**
 * Query Generation Integration Tests
 * 
 * These tests verify the integration between query generation and search:
 * - Generation of queries from business descriptions
 * - Using generated queries to execute searches
 * - End-to-end flow from business input to search results
 */

// Import Jest types setup to fix TypeScript errors with assertions
import '../setup-jest-types';
import { 
  generateSearchQueries,
  analyzeBusinessDescription,
  generateDiverseQueryTypes
} from '../../lib/query-generation';
import { search } from '../../lib/search-service';

// Mock the search function
jest.mock('../../lib/search-service', () => ({
  search: jest.fn().mockImplementation(async (query) => {
    // Return mock search results
    return [
      {
        url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}`,
        title: `Example ${query} Results`,
        description: `This is a mock search result for "${query}"`,
        source: "brave" as const,
      },
      {
        url: `https://test-example.com/${query.replace(/\s+/g, '-').toLowerCase()}`,
        title: `Test ${query} Results`,
        description: `This is another mock search result for "${query}"`,
        source: "brave" as const,
      }
    ];
  })
}));

// Create a mock for the OpenAI client
jest.mock('../../lib/ai/openai', () => {
  const mockComplete = jest.fn();
  
  // Default mock response for OpenAI
  mockComplete.mockImplementation(async ({ messages }) => {
    // Check message content to determine response type
    const userMessage = messages.find(m => m.role === 'user')?.content || '';
    
    if (userMessage.includes('Analyze the following business description')) {
      // Return business analysis
      return {
        content: JSON.stringify({
          businessType: "review automation software",
          industry: "dental",
          targetAudience: "dentists, dental practices",
          location: "Dallas, Texas",
          problemSolved: "patient review collection and management",
          keyFeatures: ["automatic review collection", "review management"],
          sellingPoints: ["save time", "increase online reputation"]
        }),
        id: 'test-id',
        model: 'gpt-4o',
        created: 1615221580
      };
    } 
    else if (userMessage.includes('specific search queries to find potential leads')) {
      // Return queries
      return {
        content: JSON.stringify({
          queries: [
            {
              searchQuery: "dentists in Dallas Texas",
              targetType: "local dental practices",
              explanation: "Direct search for dental practices in the specified location"
            },
            {
              searchQuery: "dental office managers Dallas",
              targetType: "decision makers",
              explanation: "Targets the people who make software decisions at dental practices"
            }
          ]
        }),
        id: 'test-id',
        model: 'gpt-4o',
        created: 1615221580
      };
    }
    else if (userMessage.includes('Create one search query for each of these query types')) {
      // Return diverse query types
      return {
        content: JSON.stringify({
          queries: [
            {
              searchQuery: "dentists in Dallas Texas",
              targetType: "location-based",
              explanation: "Basic location search"
            },
            {
              searchQuery: "dental practice managers Dallas",
              targetType: "role-based",
              explanation: "Targeting specific roles"
            },
            {
              searchQuery: "dental practices with online reviews Dallas",
              targetType: "feature-based",
              explanation: "Focus on practices already managing reviews"
            }
          ]
        }),
        id: 'test-id',
        model: 'gpt-4o',
        created: 1615221580
      };
    }
    else {
      // Default response
      return {
        content: "Test response",
        id: 'test-id',
        model: 'gpt-3.5-turbo',
        created: 1615221580
      };
    }
  });
  
  // Return the mocked implementation
  return {
    OpenAIClient: jest.fn().mockImplementation(() => ({
      complete: mockComplete
    })),
    createOpenAIClient: jest.fn().mockImplementation(() => ({
      complete: mockComplete
    }))
  };
});

describe('Query Generation Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Business Description to Search Results Flow', () => {
    it('should generate queries from a business description and execute searches', async () => {
      // Arrange
      const businessDescription = "I run a review automation software for dentists in Dallas Texas";
      
      // Step 1: Analyze the business description
      const analysis = await analyzeBusinessDescription(businessDescription);
      
      // Step 2: Generate search queries based on the analysis
      const queries = await generateSearchQueries({
        businessType: analysis.businessType,
        location: analysis.location
      });
      
      // Step 3: Execute search for each query
      const searchPromises = queries.map(query => search(query.searchQuery));
      const searchResults = await Promise.all(searchPromises);
      
      // Assert
      // Check analysis
      expect(analysis.businessType).toBe("review automation software");
      expect(analysis.industry).toBe("dental");
      
      // Check queries
      expect(queries.length).toBeGreaterThan(0);
      
      // Check that search was called for each query
      expect(search).toHaveBeenCalledTimes(queries.length);
      
      // Check search results
      searchResults.forEach((results, index) => {
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].url).toContain(queries[index].searchQuery.replace(/\s+/g, '-').toLowerCase());
      });
    });
  });
  
  describe('Diverse Query Generation Integration', () => {
    it('should generate diverse query types and execute searches for each', async () => {
      // Arrange
      const businessType = "review automation software for dentists";
      const location = "Dallas Texas";
      
      // Act
      // Step 1: Generate diverse query types
      const queries = await generateDiverseQueryTypes(businessType, location);
      
      // Step 2: Execute search for each query
      const searchPromises = queries.map(query => search(query.searchQuery));
      const searchResults = await Promise.all(searchPromises);
      
      // Assert
      // Check queries
      expect(queries.length).toBeGreaterThan(0);
      
      // Check that we have different types of queries
      const queryTypes = new Set(queries.map(q => q.targetType));
      expect(queryTypes.size).toBeGreaterThan(1);
      
      // Check that search was called for each query
      expect(search).toHaveBeenCalledTimes(queries.length);
      
      // Check search results
      searchResults.forEach(results => {
        expect(results.length).toBeGreaterThan(0);
      });
    });
  });
}); 