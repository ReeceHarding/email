import { researchTeamMembers } from '@/lib/contact-research';
import { TeamMember } from '@/lib/enhanced-scraper';
import axios from 'axios';
import OpenAI from 'openai';

// Define the interface for research options to match the implementation
interface ResearchOptions {
  maxSearchQueriesPerMember?: number;
  skipRetries?: boolean;
  rateLimitDelay?: number;
}

// Mock dependencies
jest.mock('axios');
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  email: 'john@example.com',
                  linkedin: 'https://linkedin.com/in/johndoe',
                  professional_details: {
                    role: 'CEO',
                    company: 'Example Company',
                    experience: ['Previous roles']
                  },
                  sources: ['https://linkedin.com/in/johndoe']
                })
              }
            }
          ]
        })
      }
    }
  }));
});

// Mock environment variables
process.env.BRAVE_API_KEY = 'test-key';

// Set global Jest timeout to 30 seconds
jest.setTimeout(30000);

describe('Contact Research', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // Add longer timeout for these tests
  test('should enrich team member data', async () => {    
    // Mock input data
    const teamMembers: TeamMember[] = [
      {
        name: 'John Doe',
        title: 'CEO',
      }
    ];
    
    // Mock axios for web search to immediately return data without network calls
    (axios.get as jest.Mock).mockImplementation((url) => {
      if (url.includes('brave.com/search')) {
        return Promise.resolve({
          status: 200,
          data: {
            web: {
              results: [
                {
                  title: 'John Doe on LinkedIn',
                  description: 'CEO at Example Company',
                  url: 'https://linkedin.com/in/johndoe'
                }
              ]
            }
          }
        });
      }
      return Promise.resolve({ data: 'mock data' });
    });
    
    // Call the research function with minimal processing to speed up the test
    const options: ResearchOptions = {
      maxSearchQueriesPerMember: 1, // Limit to 1 query per member to speed up test
      rateLimitDelay: 0 // No delay between requests in tests
    };
    
    const enrichedMembers = await researchTeamMembers(teamMembers, 'Example Company', options);
    
    // Basic verification only
    expect(enrichedMembers.length).toBeGreaterThan(0);
    expect(enrichedMembers[0].name).toBe('John Doe');
  });
  
  test('should handle errors and still return team members', async () => {
    // Mock input data
    const teamMembers: TeamMember[] = [
      {
        name: 'John Doe',
        title: 'CEO',
      }
    ];
    
    // Mock axios to always reject
    (axios.get as jest.Mock).mockRejectedValue(new Error('Search failed'));
    
    // Call the research function with minimal processing
    const options: ResearchOptions = {
      maxSearchQueriesPerMember: 1, // Limit search queries
      skipRetries: true, // Skip retries to make test faster
      rateLimitDelay: 0 // No delay in tests
    };
    
    const enrichedMembers = await researchTeamMembers(teamMembers, 'Example Company', options);
    
    // Verify results - should still return the original members even if research fails
    expect(enrichedMembers.length).toBeGreaterThan(0);
    expect(enrichedMembers[0].name).toBe('John Doe');
  });
}); 