/**
 * Query Generation Tests
 * 
 * These tests verify the functionality of the query generation system:
 * - Basic query generation from business descriptions
 * - Diverse query types generation
 * - Location-based query formatting
 * - Error handling for invalid inputs
 * - Query scoring and prioritization
 */

// Import Jest types setup to fix TypeScript errors with assertions
import '../setup-jest-types';
import { 
  generateSearchQueries,
  generateLocationQuery,
  analyzeBusinessDescription,
  generateDiverseQueryTypes,
  scoreAndPrioritizeQueries,
} from '../../lib/query-generation';

// Create a mock for the OpenAI client
jest.mock('../../lib/ai/openai', () => {
  const mockComplete = jest.fn();
  
  // Mock the OpenAIClient class
  return {
    OpenAIClient: jest.fn().mockImplementation(() => ({
      complete: mockComplete
    })),
    createOpenAIClient: jest.fn().mockImplementation(() => ({
      complete: mockComplete
    }))
  };
});

// Import the mocked version of OpenAI client
import { createOpenAIClient } from '../../lib/ai/openai';

describe('Query Generation', () => {
  // Mock OpenAI client and responses
  const mockOpenAIClient = createOpenAIClient();
  const mockComplete = mockOpenAIClient.complete as jest.Mock;
  
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock response for basic query generation
    mockComplete.mockResolvedValue({
      content: JSON.stringify({
        queries: [
          {
            searchQuery: "dentists in Dallas Texas",
            targetType: "local dental practices",
            explanation: "Direct search for dental practices in the specified location"
          },
          {
            searchQuery: "best reviewed dentists Dallas",
            targetType: "highly-rated dental practices",
            explanation: "Targets well-reviewed dental practices that may need review automation"
          },
          {
            searchQuery: "dental practice management Dallas",
            targetType: "dental practices with sophisticated management",
            explanation: "Targets practices that invest in management systems and likely to adopt new software"
          }
        ]
      }),
      id: 'test-id',
      model: 'gpt-4o',
      created: 1615221580
    });
  });
  
  describe('Basic Business Description Processing', () => {
    it('should generate relevant queries from a basic business description', async () => {
      // Arrange
      const businessType = "review automation software for dentists";
      const location = "Dallas Texas";
      
      // Act
      const queries = await generateSearchQueries({
        businessType,
        location
      });
      
      // Assert
      expect(queries).toHaveLength(3);
      expect(queries[0].searchQuery).toContain("dentists");
      expect(queries[0].searchQuery).toContain("Dallas");
      expect(mockComplete).toHaveBeenCalledTimes(1);
    });
    
    it('should handle business descriptions without location', async () => {
      // Arrange
      const businessType = "review automation software for dentists";
      
      // Act
      const queries = await generateSearchQueries({
        businessType
      });
      
      // Assert
      expect(queries).toHaveLength(3);
      expect(mockComplete).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Diverse Query Generation', () => {
    it('should generate diverse query types based on the same input', async () => {
      // Arrange
      const businessType = "review automation software for dentists";
      const location = "Dallas Texas";
      
      // Mock diverse query types response
      mockComplete.mockResolvedValue({
        content: JSON.stringify({
          queries: [
            {
              searchQuery: "dentists in Dallas Texas",
              targetType: "location-based",
              explanation: "Direct search for dental practices in the specific location"
            },
            {
              searchQuery: "dental office managers Dallas",
              targetType: "role-based",
              explanation: "Targets specific role responsible for software decisions"
            },
            {
              searchQuery: "Dallas dental practices with online reviews",
              targetType: "feature-based",
              explanation: "Identifies practices already engaged with online reviews"
            },
            {
              searchQuery: "dental practices using practice management software Dallas",
              targetType: "technology-based",
              explanation: "Targets practices already using technology solutions"
            }
          ]
        }),
        id: 'test-id',
        model: 'gpt-4o',
        created: 1615221580
      });
      
      // Act
      const queries = await generateDiverseQueryTypes(businessType, location);
      
      // Assert
      expect(queries).toHaveLength(4);
      
      // Check if we have different target types
      const targetTypes = new Set(queries.map(q => q.targetType));
      expect(targetTypes.size).toBeGreaterThan(1);
      
      // Verify we have the expected query types
      expect(targetTypes).toContain('location-based');
      expect(targetTypes).toContain('role-based');
    });
  });
  
  describe('Location-based Query Formatting', () => {
    it('should correctly format location-based queries', async () => {
      // Arrange
      const businessType = "review automation software";
      const location = "Dallas Texas";
      
      // Mock location query response
      mockComplete.mockResolvedValue({
        content: "review automation software for dental practices in Dallas, Texas",
        id: 'test-id',
        model: 'gpt-3.5-turbo',
        created: 1615221580
      });
      
      // Act
      const query = await generateLocationQuery(businessType, location);
      
      // Assert
      expect(query).toContain("Dallas");
      expect(query).toContain("review automation software");
      expect(mockComplete).toHaveBeenCalledTimes(1);
    });
    
    it('should handle missing location by returning only business type', async () => {
      // Arrange
      const businessType = "review automation software";
      
      // Act
      const query = await generateLocationQuery(businessType, "");
      
      // Assert
      expect(query).toBe(businessType);
      expect(mockComplete).not.toHaveBeenCalled();
    });
  });
  
  describe('Business Description Analysis', () => {
    it('should extract key information from business descriptions', async () => {
      // Arrange
      const businessDescription = "I run a review automation software for dentists in Dallas Texas. We help dental practices automatically collect and manage patient reviews.";
      
      // Mock analysis response
      mockComplete.mockResolvedValue({
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
      });
      
      // Act
      const analysis = await analyzeBusinessDescription(businessDescription);
      
      // Assert
      expect(analysis).toHaveProperty('businessType');
      expect(analysis).toHaveProperty('industry');
      expect(analysis).toHaveProperty('targetAudience');
      expect(analysis).toHaveProperty('location');
      expect(analysis.businessType).toBe("review automation software");
      expect(analysis.industry).toBe("dental");
      expect(mockComplete).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle empty business descriptions gracefully', async () => {
      // Arrange
      const emptyBusinessType = "";
      
      // Act
      const queries = await generateSearchQueries({
        businessType: emptyBusinessType
      });
      
      // Assert
      expect(queries).toHaveLength(0);
      expect(mockComplete).not.toHaveBeenCalled();
    });
    
    it('should handle API errors when generating queries', async () => {
      // Arrange
      const businessType = "review automation software";
      
      // Mock API error
      mockComplete.mockRejectedValue(new Error("API Error"));
      
      // Act
      const queries = await generateSearchQueries({
        businessType
      });
      
      // Assert
      expect(queries).toHaveLength(0);
      expect(mockComplete).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Query Scoring and Prioritization', () => {
    it('should score and prioritize generated queries', async () => {
      // Arrange
      const queries = [
        {
          searchQuery: "dentists in Dallas Texas",
          targetType: "location-based",
          explanation: "Direct search for dental practices in the specific location"
        },
        {
          searchQuery: "dental office managers Dallas",
          targetType: "role-based",
          explanation: "Targets specific role responsible for software decisions"
        },
        {
          searchQuery: "Dallas dental practices with online reviews",
          targetType: "feature-based",
          explanation: "Identifies practices already engaged with online reviews"
        }
      ];
      
      // Act
      const scoredQueries = await scoreAndPrioritizeQueries(queries);
      
      // Assert
      expect(scoredQueries).toHaveLength(3);
      expect(scoredQueries[0]).toHaveProperty('score');
      
      // Check if queries are sorted by score (descending)
      expect(scoredQueries[0].score).toBeGreaterThanOrEqual(scoredQueries[1].score);
      expect(scoredQueries[1].score).toBeGreaterThanOrEqual(scoredQueries[2].score);
    });
  });
}); 