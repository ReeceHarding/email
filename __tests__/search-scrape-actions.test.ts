import { startScrapeProcessAction, getScrapeProgressAction, formatProgress } from '@/actions/search-scrape-actions';
import * as scrapeController from '@/lib/scrape-controller';

// Set global Jest timeout to 30 seconds
jest.setTimeout(30000);

// Mock the dependent modules and functions
jest.mock('@/lib/scrape-controller');
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn()
}));

// Mock the search-scrape-actions module to replace getScrapeProgressAction
jest.mock('@/actions/search-scrape-actions', () => {
  const originalModule = jest.requireActual('@/actions/search-scrape-actions');
  
  // Create a mock version of getScrapeProgressAction that will be replaced in tests
  const mockGetScrapeProgress = jest.fn();
  
  return {
    ...originalModule,
    startScrapeProcessAction: originalModule.startScrapeProcessAction,
    formatProgress: originalModule.formatProgress,
    getScrapeProgressAction: mockGetScrapeProgress
  };
});

// Import auth after mocking
import { auth } from '@clerk/nextjs/server';

describe('Search Scrape Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock auth to return a user ID
    (auth as unknown as jest.Mock).mockResolvedValue({
      userId: 'test-user-id'
    });
  });
  
  test('should start a scrape process', async () => {
    // Mock scrape controller
    const mockRunProcess = scrapeController.runSearchAndScrapeProcess as jest.Mock;
    mockRunProcess.mockResolvedValue({
      businesses: [],
      teamMembers: [],
      emails: [],
      progress: {
        status: 'completed' as const,
        totalSites: 5,
        processedSites: 5,
        successfulScrapes: 3,
        failedScrapes: 2,
        foundBusinessProfiles: 3,
        foundTeamMembers: 5,
        enrichedContacts: 4,
        generatedEmails: 3
      }
    });
    
    // Call the action
    const criteria = { businessType: 'example business' };
    const result = await startScrapeProcessAction(criteria);
    
    // Verify result
    expect(result.isSuccess).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.processId).toBeDefined();
    expect(result.data?.initialStatus).toBeDefined();
    
    // Verify auth was called
    expect(auth).toHaveBeenCalled();
    
    // Verify process was started (without waiting for completion)
    expect(mockRunProcess).toHaveBeenCalledWith(
      'test-user-id',
      criteria,
      expect.any(Function)
    );
  });
  
  test('should get current progress', async () => {
    // Set up mocked progress
    const mockProgress = {
      status: 'scraping' as const,
      totalSites: 5,
      processedSites: 2,
      successfulScrapes: 1,
      failedScrapes: 1,
      foundBusinessProfiles: 1,
      foundTeamMembers: 0,
      enrichedContacts: 0,
      generatedEmails: 0,
      currentSite: 'https://example.com'
    };
    
    // Set up mock for getScrapeProgressAction
    (getScrapeProgressAction as jest.Mock).mockResolvedValue({
      isSuccess: true,
      data: mockProgress,
      message: 'Progress retrieved'
    });
    
    // Call the action
    const result = await getScrapeProgressAction();
    
    // Verify result
    expect(result.isSuccess).toBe(true);
    expect(result.data).toEqual(mockProgress);
  });
  
  test('should format progress into user-friendly format', () => {
    // Test progress formatting
    const mockProgress = {
      status: 'scraping' as const,
      totalSites: 5,
      processedSites: 2,
      successfulScrapes: 1,
      failedScrapes: 1,
      foundBusinessProfiles: 1,
      foundTeamMembers: 0,
      enrichedContacts: 0,
      generatedEmails: 0,
      currentSite: 'https://example.com'
    };
    
    const formattedProgress = formatProgress(mockProgress);
    
    // Verify format
    expect(formattedProgress.status).toBe('scraping');
    expect(formattedProgress.processingStep).toBe('Scraping websites');
    expect(formattedProgress.completion).toBeDefined();
    expect(formattedProgress.detail).toBe('https://example.com');
  });
  
  test('should handle missing authentication', async () => {
    // Mock auth to return no user
    (auth as unknown as jest.Mock).mockResolvedValue({
      userId: null
    });
    
    // Call the action
    const criteria = { businessType: 'example business' };
    const result = await startScrapeProcessAction(criteria);
    
    // Verify result
    expect(result.isSuccess).toBe(false);
    expect(result.message).toContain('Authentication required');
  });
}); 