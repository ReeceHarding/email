import { runSearchAndScrapeProcess, SearchCriteria } from '@/lib/scrape-controller';
import * as scraper from '@/lib/enhanced-scraper';
import * as searchService from '@/lib/search-service';
import * as contactResearch from '@/lib/contact-research';
import * as contentGeneration from '@/lib/content-generation';
import * as db from '@/actions/db/business-profiles-actions';
import * as leadsDb from '@/actions/db/leads-actions';
import OpenAI from 'openai';

// Set global Jest timeout to 30 seconds
jest.setTimeout(30000);

// Mock all dependencies
jest.mock('@/lib/enhanced-scraper');
jest.mock('@/lib/search-service');
jest.mock('@/lib/contact-research');
jest.mock('@/lib/content-generation');
jest.mock('@/actions/db/business-profiles-actions');
jest.mock('@/actions/db/leads-actions');
jest.mock('openai');

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'marketing agency New York'
              }
            }
          ]
        })
      }
    }
  }));
});

describe('Scrape Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should run the entire scrape process successfully', async () => {
    // Mock search service results
    (searchService.search as jest.Mock).mockResolvedValue([
      { url: 'https://example.com', title: 'Example', description: 'Example site' }
    ]);
    
    // Mock scraper results
    (scraper.scrapeWebsite as jest.Mock).mockResolvedValue({
      success: true,
      businessData: {
        name: 'Example Company',
        website: 'https://example.com',
        description: 'An example company',
        teamMembers: [
          { name: 'Jane Doe', title: 'CEO' }
        ]
      }
    });
    
    // Mock contact research results
    (contactResearch.researchTeamMembers as jest.Mock).mockResolvedValue([
      {
        name: 'Jane Doe',
        title: 'CEO',
        email: 'jane@example.com',
        contactInfo: { email: 'jane@example.com', sources: [] },
        researchSummary: 'Jane is a CEO'
      }
    ]);
    
    // Mock content generation results
    (contentGeneration.generateEmailContent as jest.Mock).mockResolvedValue({
      subject: 'Hello from Example',
      body: 'This is a test email',
      recipientEmail: 'jane@example.com',
      recipientName: 'Jane Doe',
      variables: {}
    });
    
    // Mock database functions
    (db.createBusinessProfile as jest.Mock).mockResolvedValue({ success: true });
    (leadsDb.createLead as jest.Mock).mockResolvedValue({ success: true });
    
    // Mock OpenAI for query generation
    const mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'Search query 1\nSearch query 2'
                }
              }
            ]
          })
        }
      }
    };
    
    // Set up the mocked OpenAI instance
    (OpenAI as unknown as jest.Mock).mockImplementation(() => mockOpenAI);
    
    // Set up progress callback mock
    const progressCallback = jest.fn();
    
    // Call the process function
    const criteria: SearchCriteria = {
      businessType: 'example business',
      location: 'New York',
      maxResults: 1
    };
    
    const result = await runSearchAndScrapeProcess('test-user-id', criteria, progressCallback);
    
    // Verify the process ran successfully
    expect(result.businesses).toHaveLength(1);
    expect(result.teamMembers).toHaveLength(1);
    expect(result.emails).toHaveLength(1);
    
    // Verify progress was updated
    expect(progressCallback).toHaveBeenCalled();
    expect(result.progress.status).toBe('completed');
  });
  
  it('should handle errors during the process', async () => {
    // Mock search to succeed
    (searchService.search as jest.Mock).mockResolvedValue([
      { url: 'https://example.com', title: 'Example', description: 'Example site' }
    ]);
    
    // Mock scraper to fail
    (scraper.scrapeWebsite as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Scrape failed'
    });
    
    // Set up progress callback mock
    const progressCallback = jest.fn();
    
    // Call the process function
    const criteria: SearchCriteria = {
      businessType: 'example business',
      maxResults: 1
    };
    
    const result = await runSearchAndScrapeProcess('test-user-id', criteria, progressCallback);
    
    // Verify the process handled the error
    expect(result.businesses).toHaveLength(0);
    expect(result.teamMembers).toHaveLength(0);
    expect(result.emails).toHaveLength(0);
    
    // Verify progress was updated
    expect(progressCallback).toHaveBeenCalled();
    expect(result.progress.failedScrapes).toBeGreaterThan(0);
  });
}); 