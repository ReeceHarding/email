import { scrapeWebsite } from '@/lib/enhanced-scraper';
import puppeteer from 'puppeteer';
import axios from 'axios';

// Mock dependencies
jest.mock('puppeteer');
jest.mock('axios');

// Mock Firecrawl
jest.mock('@/lib/enhanced-scraper', () => {
  // Store the original module
  const originalModule = jest.requireActual('@/lib/enhanced-scraper');
  
  // Return the modified module
  return {
    ...originalModule,
    // Override specific functions but keep the original implementation
    scrapeWebsite: originalModule.scrapeWebsite,
    // Override internal functions that are causing issues
    scrapeWithFirecrawl: jest.fn().mockImplementation(() => {
      return { 
        success: false, 
        error: "Firecrawl test mock - forcing fallback to Puppeteer" 
      };
    })
  };
});

describe('Enhanced Scraper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return scraped business data when successful', async () => {
    // Mock browser and page
    const mockPage = {
      setViewport: jest.fn(),
      setUserAgent: jest.fn(),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      setRequestInterception: jest.fn(),
      on: jest.fn(),
      goto: jest.fn().mockResolvedValue({}),
      $: jest.fn().mockResolvedValue({}),
      evaluate: jest.fn().mockImplementation((fn) => {
        // Return different data based on the function string to handle different evaluate calls
        const fnStr = fn.toString();
        
        // For extracting internal links
        if (fnStr.includes('href') || fnStr.includes('links')) {
          return ['https://example.com/about', 'https://example.com/contact'];
        }
        
        // For extracting business name and other data
        return {
          name: 'Test Business',
          description: 'A test business description',
          socialLinks: { linkedin: 'https://linkedin.com/company/test' }
        };
      }),
    };
    
    const mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue({}),
    };
    
    (puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);
    
    // Mock axios for fallback scenarios
    (axios.get as jest.Mock).mockResolvedValue({
      data: '<html><body><h1>Test Company</h1><p>Description</p></body></html>'
    });

    // Call the scrape function
    const result = await scrapeWebsite('https://example.com', {
      // Disable Firecrawl for this test to simplify
      useFirecrawl: false,
      // Only use Puppeteer
      usePuppeteer: true,
      // Limit to 0 pages to avoid internal link crawling
      maxPages: 0
    });

    // Verify puppeteer was called
    expect(puppeteer.launch).toHaveBeenCalled();
    expect(mockBrowser.newPage).toHaveBeenCalled();
    
    // Use expect.stringContaining to handle normalized URL with trailing slash
    expect(mockPage.goto).toHaveBeenCalledWith(
      expect.stringContaining('https://example.com'), 
      expect.any(Object)
    );
    
    // Verify the result
    expect(result.success).toBe(true);
    expect(result.businessData).toBeDefined();
    if (result.businessData) {
      expect(result.businessData.name).toBeDefined();
    }
    
    // Verify browser was closed
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    // Mock browser and page with error
    (puppeteer.launch as jest.Mock).mockRejectedValue(new Error('Browser error'));
    
    // Mock axios for fallback
    (axios.get as jest.Mock).mockRejectedValue(new Error('Request error'));

    // Call the scrape function with both methods disabled to force error
    const result = await scrapeWebsite('https://example.com', {
      useFirecrawl: false
    });

    // Verify error handling
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
}); 