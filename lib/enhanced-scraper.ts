import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { delay } from './utils';
import Firecrawl from '@mendable/firecrawl-js';
import "dotenv/config";

// Define TeamMember interface
export interface TeamMember {
  name: string;
  title?: string;
  email?: string;
  linkedin?: string;
  bio?: string;
}

// TeamMember extraction - copied from firecrawl.ts
function extractTeamMembers(text: string): TeamMember[] {
  const lines = text.split("\n");
  const found: TeamMember[] = [];
  const seenNames = new Set<string>();

  // Common words that might appear capitalized but aren't names
  const falsePositives = new Set([
    "Meet Our",
    "About Our",
    "About Us",
    "Contact Us",
    "Our Team",
    "The Team",
    "Leadership Team",
    "Executive Team",
    "Management Team",
    "Board Of",
    "Learn More"
  ]);

  // Name regex pattern - looks for capitalized full names
  const nameRegex = /\b(?:(?:Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.|Rev\.|Sr\.|Jr\.|[A-Z]\.)\s+)?([A-Z][a-z]+(?:-[A-Z][a-z]+)?)\s+([A-Z][a-z]+(?:-[A-Z][a-z]+)?(?:\s+(?:Sr\.|Jr\.|III|IV|II))?)\b(?:\s+(?:Sr\.|Jr\.|III|IV|II))?/g;

  // Title regex - looks for common professional titles
  const titleRegex = /\b(CEO|Founder|Co-Founder|Owner|President|Manager|Director|Doctor|MD|DDS|Chiropractor|Officer|Lead|Head|VP|Vice President|Chief|Partner|Principal|Executive)\b/i;

  for (const line of lines) {
    const matches = Array.from(line.matchAll(nameRegex));
    
    for (const match of matches) {
      // Get the full name including any title
      const fullName = match[0].trim();
      
      // Skip if we've seen this name or it's in our false positives list
      if (seenNames.has(fullName) || falsePositives.has(fullName)) {
        continue;
      }

      // Extract title if present
      const roleMatch = line.match(titleRegex);
      let title: string | undefined = undefined;
      
      if (roleMatch) {
        title = roleMatch[0].trim();
      }

      found.push({
        name: fullName,
        title,
        bio: line.trim()
      });

      seenNames.add(fullName);
    }
  }

  return found;
}

// Constants
const SCRAPE_TIMEOUT = 60000; // 1 minute
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const MAX_PAGES_PER_SITE = 10;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || "";

// Selectors for important data
const SELECTORS = {
  emails: '[href^="mailto:"], a[href*="@"], .email',
  phones: '[href^="tel:"], .phone, .tel, .telephone',
  socialLinks: [
    { 
      platform: 'linkedin', 
      selectors: 'a[href*="linkedin.com"]'
    },
    { 
      platform: 'twitter', 
      selectors: 'a[href*="twitter.com"], a[href*="x.com"]'
    },
    { 
      platform: 'facebook', 
      selectors: 'a[href*="facebook.com"]'
    },
    { 
      platform: 'instagram', 
      selectors: 'a[href*="instagram.com"]'
    },
    { 
      platform: 'youtube', 
      selectors: 'a[href*="youtube.com"]'
    }
  ]
};

// Page type detection patterns
const PAGE_TYPE_PATTERNS = {
  about: [/about(-us)?/, /our-story/, /who-we-are/, /our-practice/, /mission/],
  team: [/team/, /staff/, /doctors?/, /physicians?/, /providers?/, /our-team/, /meet-.*team/, /medical-staff/],
  contact: [/contact(-us)?/, /locations?/, /offices?/, /find-us/, /directions/, /appointments?/, /schedule/],
  services: [/services/, /treatments?/, /procedures/, /what-we-do/, /our-services/, /specialties/]
};

// Email regex pattern
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// Phone regex pattern - matches various formats
const PHONE_REGEX = /(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;

export interface BusinessData {
  name: string;
  description?: string;
  website: string;
  address?: string;
  phone?: string;
  email?: string;
  hours?: string[];
  services?: Array<{
    name: string;
    description?: string;
    price?: string;
  }>;
  teamMembers?: TeamMember[];
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    youtube?: string;
    [key: string]: string | undefined;
  };
  certifications?: string[];
  specialties?: string[];
  foundingYear?: string;
  companyValues?: string[];
  industries?: string[];
  scrapedPages?: {
    url: string;
    title: string;
    type: string;
  }[];
  rawText?: string;
}

export interface ScrapeOptions {
  maxPages?: number;
  maxDepth?: number;
  timeout?: number;
  retries?: number;
  followInternalLinks?: boolean;
  useFirecrawl?: boolean;
  usePuppeteer?: boolean;
  includeRawText?: boolean;
}

interface PageInfo {
  url: string;
  title: string;
  type: string;
  text: string;
  html: string;
}

/**
 * Main scraper function that coordinates the scraping strategy
 */
export async function scrapeWebsite(
  url: string,
  options: ScrapeOptions = {}
): Promise<{ success: boolean; businessData?: BusinessData; error?: string }> {
  console.log(`[EnhancedScraper] Starting scrape for URL: ${url}`);
  
  const {
    maxPages = MAX_PAGES_PER_SITE,
    timeout = SCRAPE_TIMEOUT,
    retries = MAX_RETRIES,
    useFirecrawl = true,
    usePuppeteer = true,
    includeRawText = false
  } = options;

  try {
    // Normalize URL
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) {
      return { success: false, error: "Invalid URL format" };
    }

    console.log(`[EnhancedScraper] Normalized URL: ${normalizedUrl}`);

    // Try Firecrawl first if available and enabled
    if (useFirecrawl && FIRECRAWL_API_KEY) {
      try {
        console.log(`[EnhancedScraper] Attempting to use Firecrawl for ${normalizedUrl}`);
        const firecrawlResult = await scrapeWithFirecrawl(normalizedUrl);
        
        if (firecrawlResult.success && firecrawlResult.businessData) {
          console.log(`[EnhancedScraper] Firecrawl successful for ${normalizedUrl}`);
          
          // If we need detailed page data, enhance with puppeteer
          if (usePuppeteer) {
            console.log(`[EnhancedScraper] Enhancing Firecrawl data with Puppeteer`);
            const enhancedData = await enhanceWithPuppeteer(
              normalizedUrl, 
              firecrawlResult.businessData,
              { maxPages, timeout, includeRawText }
            );
            return { success: true, businessData: enhancedData };
          }
          
          return firecrawlResult;
        }
        
        console.log(`[EnhancedScraper] Firecrawl failed or returned limited data: ${firecrawlResult.error}`);
      } catch (error: any) {
        console.error(`[EnhancedScraper] Firecrawl error: ${error.message}`);
      }
    }
    
    // Fallback to Puppeteer
    if (usePuppeteer) {
      console.log(`[EnhancedScraper] Using Puppeteer for ${normalizedUrl}`);
      return await scrapeWithPuppeteer(normalizedUrl, { 
        maxPages, 
        timeout,
        includeRawText 
      });
    }
    
    // Last resort: basic scraper
    console.log(`[EnhancedScraper] Using basic scraper for ${normalizedUrl}`);
    return await scrapeWithBasicFetch(normalizedUrl);
    
  } catch (error: any) {
    console.error(`[EnhancedScraper] Scraping failed: ${error.message}`);
    return { 
      success: false, 
      error: `Scraping failed: ${error.message}` 
    };
  }
}

/**
 * Normalize a URL to ensure it has a protocol and is properly formatted
 */
function normalizeUrl(url: string): string | null {
  try {
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Parse and reconstruct to normalize
    const parsedUrl = new URL(url);
    return parsedUrl.toString();
  } catch (error) {
    console.error(`[EnhancedScraper] Invalid URL: ${url}`, error);
    return null;
  }
}

/**
 * Scrape using the Firecrawl API 
 */
async function scrapeWithFirecrawl(
  url: string
): Promise<{ success: boolean; businessData?: BusinessData; error?: string }> {
  try {
    if (!FIRECRAWL_API_KEY) {
      return { success: false, error: "Firecrawl API key not configured" };
    }
    
    const firecrawl = new Firecrawl({ apiKey: FIRECRAWL_API_KEY });
    
    console.log(`[EnhancedScraper] Calling Firecrawl API for ${url}`);
    
    // Handle different Firecrawl API versions dynamically
    let result: any;
    // Try methods that might exist in the API
    if (typeof (firecrawl as any).crawl === 'function') {
      result = await (firecrawl as any).crawl({ url, level: 2 });
    } else if (typeof (firecrawl as any).fetch === 'function') {
      result = await (firecrawl as any).fetch(url, { extractMetadata: true });
    } else {
      // Fallback to basic method if available
      result = await (firecrawl as any).getHtml(url);
    }
    
    if (!result || !result.success) {
      return { 
        success: false, 
        error: result?.error?.message || "Unknown Firecrawl error" 
      };
    }
    
    console.log(`[EnhancedScraper] Firecrawl API success, processing data`);
    
    // Extract business data from HTML
    const $ = cheerio.load(result.html || "");
    
    // Get all text content
    const rawText = extractVisibleText($);
    
    // Extract emails
    const emails = extractEmails(rawText);
    
    // Extract team members
    const teamMembers = extractTeamMembers(rawText);
    
    // Extract social links
    const socialLinks = extractSocialLinks($);
    
    // Build business data
    const businessData: BusinessData = {
      name: result.metadata?.title || extractBusinessName($) || new URL(url).hostname,
      description: result.metadata?.description || extractDescription($),
      website: url,
      email: emails[0],
      teamMembers,
      socialLinks,
      rawText: rawText
    };
    
    return { success: true, businessData };
  } catch (error: any) {
    console.error(`[EnhancedScraper] Firecrawl error: ${error.message}`);
    return { success: false, error: `Firecrawl failed: ${error.message}` };
  }
}

/**
 * Scrape using Puppeteer
 */
async function scrapeWithPuppeteer(
  url: string,
  options: { maxPages?: number; timeout?: number; includeRawText?: boolean }
): Promise<{ success: boolean; businessData?: BusinessData; error?: string }> {
  const { maxPages = MAX_PAGES_PER_SITE, timeout = SCRAPE_TIMEOUT, includeRawText = false } = options;
  
  let browser: Browser | null = null;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set timeouts
    await page.setDefaultNavigationTimeout(timeout);
    await page.setDefaultTimeout(timeout / 2);
    
    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', request => {
      const resourceType = request.resourceType();
      if (
        resourceType === 'image' ||
        resourceType === 'font' ||
        resourceType === 'media' ||
        request.url().includes('google-analytics') ||
        request.url().includes('facebook.com') ||
        request.url().includes('doubleclick')
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // Set up error handlers
    page.on('error', err => console.error(`[EnhancedScraper] Page error: ${err.message}`));
    page.on('pageerror', err => console.error(`[EnhancedScraper] Page error: ${err}`));
    
    console.log(`[EnhancedScraper] Navigating to ${url}`);
    
    // Navigate to URL
    try {
      await page.goto(url, { waitUntil: 'networkidle2' });
    } catch (error) {
      console.log(`[EnhancedScraper] Navigation timeout, retrying with domcontentloaded`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    }
    
    // Handle popups and cookie banners
    await handlePopups(page);
    
    // Scroll to load lazy content
    await autoScroll(page);
    
    // Get base data from main page
    const businessData: BusinessData = {
      name: await extractTextFromPage(page, 'h1') || await extractBusinessNameFromPage(page) || new URL(url).hostname,
      description: await extractDescriptionFromPage(page),
      website: url,
      scrapedPages: [],
      socialLinks: await extractSocialLinksFromPage(page)
    };
    
    // Get internal links
    console.log(`[EnhancedScraper] Finding internal links`);
    const links = await findRelevantInternalLinks(page, url, maxPages);
    
    // Process the main page
    const mainPageInfo = await extractPageInfo(page, url);
    if (mainPageInfo) {
      businessData.scrapedPages?.push({
        url,
        title: mainPageInfo.title,
        type: mainPageInfo.type
      });
      
      if (includeRawText) {
        businessData.rawText = mainPageInfo.text;
      }
    }
    
    // Extract emails from main page
    const emails = await extractEmailsFromPage(page);
    if (emails.length > 0) {
      businessData.email = emails[0];
    }
    
    // Extract phone from main page
    const phones = await extractPhonesFromPage(page);
    if (phones.length > 0) {
      businessData.phone = phones[0];
    }
    
    // Visit and process other key pages
    console.log(`[EnhancedScraper] Found ${links.length} links to crawl`);
    
    // We need to collect all text content for team member extraction
    let allText = mainPageInfo?.text || '';
    
    // Process each link
    for (const link of links) {
      try {
        console.log(`[EnhancedScraper] Processing link: ${link}`);
        await page.goto(link, { waitUntil: 'domcontentloaded' });
        
        // Handle popups and scroll
        await handlePopups(page);
        await autoScroll(page);
        
        // Extract page info
        const pageInfo = await extractPageInfo(page, link);
        if (pageInfo) {
          businessData.scrapedPages?.push({
            url: link,
            title: pageInfo.title,
            type: pageInfo.type
          });
          
          // Add to all text
          allText += ' ' + pageInfo.text;
          
          // Process page based on type
          await processPageByType(page, pageInfo, businessData);
          
          // Always look for emails and phones on every page
          const pageEmails = await extractEmailsFromPage(page);
          if (pageEmails.length > 0 && !businessData.email) {
            businessData.email = pageEmails[0];
          }
          
          const pagePhones = await extractPhonesFromPage(page);
          if (pagePhones.length > 0 && !businessData.phone) {
            businessData.phone = pagePhones[0];
          }
        }
      } catch (error: any) {
        console.error(`[EnhancedScraper] Error processing link ${link}: ${error.message}`);
      }
    }
    
    // Extract team members from all text
    const teamMembers = extractTeamMembers(allText);
    if (teamMembers.length > 0) {
      businessData.teamMembers = teamMembers;
    }
    
    console.log(`[EnhancedScraper] Completed scraping ${url}`);
    return { success: true, businessData };
    
  } catch (error: any) {
    console.error(`[EnhancedScraper] Puppeteer error: ${error.message}`);
    return { success: false, error: `Puppeteer scraping failed: ${error.message}` };
  } finally {
    if (browser) {
      console.log(`[EnhancedScraper] Closing browser`);
      await browser.close();
    }
  }
}

/**
 * Combine Firecrawl data with additional data from Puppeteer
 */
async function enhanceWithPuppeteer(
  url: string,
  firecrawlData: BusinessData,
  options: { maxPages?: number; timeout?: number; includeRawText?: boolean }
): Promise<BusinessData> {
  try {
    const puppeteerResult = await scrapeWithPuppeteer(url, options);
    
    if (puppeteerResult.success && puppeteerResult.businessData) {
      // Merge data, preferring Firecrawl data where available
      return {
        ...puppeteerResult.businessData,
        ...firecrawlData,
        // Merge these specific fields carefully
        socialLinks: {
          ...puppeteerResult.businessData.socialLinks,
          ...firecrawlData.socialLinks
        },
        teamMembers: [
          ...(firecrawlData.teamMembers || []),
          ...(puppeteerResult.businessData.teamMembers || []).filter(
            member => !firecrawlData.teamMembers?.some(
              existingMember => existingMember.name === member.name
            )
          )
        ],
        scrapedPages: [
          ...(firecrawlData.scrapedPages || []),
          ...(puppeteerResult.businessData.scrapedPages || [])
        ]
      };
    }
    
    return firecrawlData;
  } catch (error: any) {
    console.error(`[EnhancedScraper] Enhancement error: ${error.message}`);
    return firecrawlData;
  }
}

/**
 * Use a basic HTTP fetch to scrape a website
 */
async function scrapeWithBasicFetch(
  url: string
): Promise<{ success: boolean; businessData?: BusinessData; error?: string }> {
  try {
    console.log(`[EnhancedScraper] Using basic fetch for ${url}`);
    
    const response = await axios.get(url, {
      timeout: SCRAPE_TIMEOUT / 2,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Extract text
    const text = extractVisibleText($);
    
    // Extract business information
    const name = extractBusinessName($) || new URL(url).hostname;
    const description = extractDescription($);
    const emails = extractEmails(text);
    const phones = extractPhones(text);
    const socialLinks = extractSocialLinks($);
    const teamMembers = extractTeamMembers(text);
    
    // Build business data
    const businessData: BusinessData = {
      name,
      description,
      website: url,
      email: emails[0],
      phone: phones[0],
      teamMembers,
      socialLinks,
      rawText: text
    };
    
    return { success: true, businessData };
  } catch (error: any) {
    console.error(`[EnhancedScraper] Basic fetch error: ${error.message}`);
    return { success: false, error: `Basic fetch failed: ${error.message}` };
  }
}

/**
 * Extract only the visible text content from HTML
 */
function extractVisibleText($: cheerio.CheerioAPI): string {
  $('script, style, noscript, iframe, img').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

/**
 * Extract the business name from HTML
 */
function extractBusinessName($: cheerio.CheerioAPI): string | undefined {
  // Try common selectors for business name
  const selectors = [
    'header h1',
    '.logo h1',
    '.logo img[alt]',
    '.brand h1',
    '.brand-logo img[alt]',
    '.site-title',
    'h1.company-name',
    '.company-name',
    'h1'
  ];
  
  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length) {
      if (selector.includes('img[alt]')) {
        const alt = element.attr('alt');
        if (alt && alt.trim().length > 0) {
          return alt.trim();
        }
      } else {
        const text = element.text().trim();
        if (text.length > 0) {
          return text;
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Extract the description from HTML
 */
function extractDescription($: cheerio.CheerioAPI): string | undefined {
  // Try meta description first
  const metaDescription = $('meta[name="description"]').attr('content');
  if (metaDescription && metaDescription.length > 10) {
    return metaDescription.trim();
  }
  
  // Try common about text sections
  const selectors = [
    '.about-us p',
    '.about p',
    '.company-description',
    '#about p',
    'section.about p',
    '.home-intro p',
    '.intro p'
  ];
  
  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length) {
      const text = element.text().trim();
      if (text.length > 20) {
        return text;
      }
    }
  }
  
  // Fallback to the first substantial paragraph
  const firstP = $('p').filter(function() {
    return $(this).text().trim().length > 50;
  }).first();
  
  if (firstP.length) {
    return firstP.text().trim();
  }
  
  return undefined;
}

/**
 * Extract social media links from HTML
 */
function extractSocialLinks($: cheerio.CheerioAPI): BusinessData['socialLinks'] {
  const socialLinks: BusinessData['socialLinks'] = {};
  
  for (const { platform, selectors } of SELECTORS.socialLinks) {
    $(selectors).each(function() {
      const href = $(this).attr('href');
      if (href && !href.includes('share') && !href.includes('sharer')) {
        socialLinks[platform as keyof BusinessData['socialLinks']] = href;
      }
    });
  }
  
  return Object.keys(socialLinks).length > 0 ? socialLinks : undefined;
}

/**
 * Extract emails from text
 */
function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) || [];
  return [...new Set(matches)]; // Deduplicate
}

/**
 * Extract phone numbers from text
 */
function extractPhones(text: string): string[] {
  const matches = text.match(PHONE_REGEX) || [];
  return [...new Set(matches)]; // Deduplicate
}

// PUPPETEER HELPER FUNCTIONS

/**
 * Extract emails from a page
 */
async function extractEmailsFromPage(page: Page): Promise<string[]> {
  return await page.evaluate((emailRegex) => {
    const bodyText = document.body.innerText;
    const emailMatches = bodyText.match(new RegExp(emailRegex, 'g')) || [];
    
    // Look for mailto links
    const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
    const mailtoEmails = mailtoLinks.map(link => {
      const href = link.getAttribute('href') || '';
      return href.replace('mailto:', '').split('?')[0].trim();
    });
    
    return [...new Set([...emailMatches, ...mailtoEmails])];
  }, EMAIL_REGEX.source);
}

/**
 * Extract phone numbers from a page
 */
async function extractPhonesFromPage(page: Page): Promise<string[]> {
  return await page.evaluate((phoneRegex) => {
    const bodyText = document.body.innerText;
    const phoneMatches = bodyText.match(new RegExp(phoneRegex, 'g')) || [];
    
    // Look for tel links
    const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'));
    const telNumbers = telLinks.map(link => {
      const href = link.getAttribute('href') || '';
      return href.replace('tel:', '').trim();
    });
    
    return [...new Set([...phoneMatches, ...telNumbers])];
  }, PHONE_REGEX.source);
}

/**
 * Extract social links from a page
 */
async function extractSocialLinksFromPage(page: Page): Promise<BusinessData['socialLinks']> {
  return await page.evaluate(() => {
    const socialLinks: Record<string, string> = {};
    
    // Check for LinkedIn
    const linkedinLinks = Array.from(document.querySelectorAll('a[href*="linkedin.com"]'));
    if (linkedinLinks.length > 0) {
      const href = linkedinLinks[0].getAttribute('href');
      if (href && !href.includes('share')) {
        socialLinks.linkedin = href;
      }
    }
    
    // Check for Twitter
    const twitterLinks = Array.from(document.querySelectorAll('a[href*="twitter.com"], a[href*="x.com"]'));
    if (twitterLinks.length > 0) {
      const href = twitterLinks[0].getAttribute('href');
      if (href && !href.includes('share')) {
        socialLinks.twitter = href;
      }
    }
    
    // Check for Facebook
    const facebookLinks = Array.from(document.querySelectorAll('a[href*="facebook.com"]'));
    if (facebookLinks.length > 0) {
      const href = facebookLinks[0].getAttribute('href');
      if (href && !href.includes('share') && !href.includes('sharer')) {
        socialLinks.facebook = href;
      }
    }
    
    // Check for Instagram
    const instagramLinks = Array.from(document.querySelectorAll('a[href*="instagram.com"]'));
    if (instagramLinks.length > 0) {
      socialLinks.instagram = instagramLinks[0].getAttribute('href') || '';
    }
    
    // Check for YouTube
    const youtubeLinks = Array.from(document.querySelectorAll('a[href*="youtube.com"]'));
    if (youtubeLinks.length > 0) {
      const href = youtubeLinks[0].getAttribute('href');
      if (href && !href.includes('watch')) {
        socialLinks.youtube = href;
      }
    }
    
    return Object.keys(socialLinks).length > 0 ? socialLinks : undefined;
  });
}

/**
 * Extract business name from a page
 */
async function extractBusinessNameFromPage(page: Page): Promise<string | undefined> {
  return await page.evaluate(() => {
    // Try common selectors for business name
    const selectors = [
      'header h1',
      '.logo h1',
      '.logo img[alt]',
      '.brand h1',
      '.brand-logo img[alt]',
      '.site-title',
      'h1.company-name',
      '.company-name',
      'h1'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        const element = elements[0];
        if (selector.includes('img[alt]')) {
          const alt = element.getAttribute('alt');
          if (alt && alt.trim().length > 0) {
            return alt.trim();
          }
        } else {
          const text = element.textContent || '';
          if (text.trim().length > 0) {
            return text.trim();
          }
        }
      }
    }
    
    // Try the title tag as a fallback
    const title = document.title;
    if (title && title.length > 0) {
      // Remove common separators and "Home" suffix
      return title.split('|')[0].split('-')[0].split('—')[0].replace(' - Home', '').trim();
    }
    
    return undefined;
  });
}

/**
 * Extract description from a page
 */
async function extractDescriptionFromPage(page: Page): Promise<string | undefined> {
  return await page.evaluate(() => {
    // Try meta description first
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      const content = metaDesc.getAttribute('content');
      if (content && content.length > 10) {
        return content.trim();
      }
    }
    
    // Try common about text sections
    const selectors = [
      '.about-us p',
      '.about p',
      '.company-description',
      '#about p',
      'section.about p',
      '.home-intro p',
      '.intro p'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        const text = elements[0].textContent || '';
        if (text.trim().length > 20) {
          return text.trim();
        }
      }
    }
    
    // Fallback to the first substantial paragraph
    const paragraphs = Array.from(document.querySelectorAll('p'));
    const firstSubstantialP = paragraphs.find(p => {
      const text = p.textContent || '';
      return text.trim().length > 50;
    });
    
    if (firstSubstantialP) {
      return firstSubstantialP.textContent?.trim();
    }
    
    return undefined;
  });
}

/**
 * Extract text from a page using a selector
 */
async function extractTextFromPage(page: Page, selector: string): Promise<string | undefined> {
  try {
    const element = await page.$(selector);
    if (element) {
      return await page.evaluate(el => el.textContent?.trim() || '', element);
    }
    return undefined;
  } catch (error) {
    console.error(`[EnhancedScraper] Error extracting text from selector ${selector}:`, error);
    return undefined;
  }
}

/**
 * Auto-scroll a page to load lazy content
 */
async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const maxScrolls = 20;
      let scrollCount = 0;
      
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        scrollCount++;
        
        if (scrollCount >= maxScrolls || totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
  
  // Wait for any lazy loaded content - Use setTimeout instead of waitForTimeout
  await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Handle popups and cookie banners
 */
async function handlePopups(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Common popup selectors
    const selectors = [
      // Cookie and GDPR banners
      'button[id*="cookie"], button[class*="cookie"]',
      'a[id*="cookie"], a[class*="cookie"]',
      'button[id*="accept"], button[class*="accept"]',
      'button[id*="agree"], button[class*="agree"]',
      'button[id*="consent"], button[class*="consent"]',
      'button[id*="close"], button[class*="close"]',
      '[aria-label*="cookie"]',
      '[aria-label*="accept"]',
      '[aria-label*="close"]',
      
      // Newsletter and subscription popups
      '.modal button, .modal .close',
      '.popup button, .popup .close',
      '.newsletter-popup .close',
      '[class*="modal"] button, [class*="popup"] button',
      
      // Chat widgets
      '.chat-widget .close',
      '[class*="chat"] button',
      '[id*="chat"] button'
    ];
    
    // Try to click each selector
    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el instanceof HTMLElement) {
            el.click();
          }
        });
      } catch (e) {
        // Ignore errors for individual popup handling
      }
    });
  });
  
  // Wait a bit for any animations to complete - Use setTimeout instead of waitForTimeout
  await new Promise(resolve => setTimeout(resolve, 500));
}

/**
 * Find relevant internal links from a page
 */
async function findRelevantInternalLinks(
  page: Page,
  baseUrl: string,
  maxLinks: number
): Promise<string[]> {
  const links = await page.evaluate((baseUrl) => {
    const hostname = new URL(baseUrl).hostname;
    const found: string[] = [];
    const seenPaths = new Set<string>();
    
    // Get all links
    const linkElements = Array.from(document.querySelectorAll('a[href]'));
    
    // Filter and prioritize links
    const priorityLinks: Array<{ url: string; priority: number }> = [];
    
    for (const link of linkElements) {
      const href = link.getAttribute('href');
      if (!href) continue;
      
      try {
        // Handle relative URLs
        const url = new URL(href, baseUrl);
        
        // Skip external links, anchor links, or non-HTTP protocols
        if (
          url.hostname !== hostname ||
          url.protocol !== 'http:' && url.protocol !== 'https:' ||
          url.pathname === '/' ||
          url.href === baseUrl ||
          url.pathname.includes('wp-login') ||
          url.pathname.includes('wp-admin') ||
          url.pathname.includes('login') ||
          url.pathname.includes('cart') ||
          url.pathname.includes('checkout')
        ) {
          continue;
        }
        
        // Skip if we've seen this path already
        if (seenPaths.has(url.pathname)) {
          continue;
        }
        
        seenPaths.add(url.pathname);
        
        // Assign priority based on path
        let priority = 0;
        const path = url.pathname.toLowerCase();
        
        // Highest priority - key pages
        if (
          path.includes('about') || 
          path.includes('team') || 
          path.includes('staff') || 
          path.includes('contact') || 
          path.includes('service')
        ) {
          priority = 3;
        }
        // Medium priority - potentially useful pages
        else if (
          path.includes('location') || 
          path.includes('office') || 
          path.includes('doctor') || 
          path.includes('provider') || 
          path.includes('specialist')
        ) {
          priority = 2;
        }
        // Lower priority - other internal pages
        else {
          priority = 1;
        }
        
        priorityLinks.push({
          url: url.href,
          priority
        });
      } catch (error) {
        // Skip invalid URLs
      }
    }
    
    // Sort by priority (higher first)
    priorityLinks.sort((a, b) => b.priority - a.priority);
    
    // Take the top links
    return priorityLinks.slice(0, 10).map(item => item.url);
  }, baseUrl);
  
  return links.slice(0, maxLinks);
}

/**
 * Extract information about a page
 */
async function extractPageInfo(page: Page, url: string): Promise<PageInfo | null> {
  try {
    return await page.evaluate((url, pagePatterns) => {
      // Get title
      const title = document.title.trim();
      
      // Get all text
      const text = document.body.innerText.replace(/\s+/g, ' ').trim();
      
      // Get HTML
      const html = document.documentElement.outerHTML;
      
      // Determine page type
      const urlPath = new URL(url).pathname.toLowerCase();
      let type = 'other';
      
      // Convert pattern objects to regular expressions
      const patterns = Object.entries(pagePatterns).map(([key, patterns]) => ({
        type: key,
        regexes: patterns.map(p => new RegExp(p.source, p.flags))
      }));
      
      // Check URL path against patterns
      for (const { type: patternType, regexes } of patterns) {
        for (const regex of regexes) {
          if (regex.test(urlPath)) {
            type = patternType;
            break;
          }
        }
        if (type !== 'other') break;
      }
      
      // If URL doesn't match, try page content
      if (type === 'other') {
        // Check headings
        const headings = Array.from(document.querySelectorAll('h1, h2, h3'));
        const headingText = headings.map(h => h.textContent?.toLowerCase() || '').join(' ');
        
        for (const { type: patternType, regexes } of patterns) {
          for (const regex of regexes) {
            if (regex.test(headingText)) {
              type = patternType;
              break;
            }
          }
          if (type !== 'other') break;
        }
      }
      
      return {
        url,
        title,
        type,
        text,
        html
      };
    }, url, PAGE_TYPE_PATTERNS);
  } catch (error) {
    console.error(`[EnhancedScraper] Error extracting page info: ${error}`);
    return null;
  }
}

/**
 * Process a page based on its type
 */
async function processPageByType(
  page: Page,
  pageInfo: PageInfo,
  businessData: BusinessData
): Promise<void> {
  switch (pageInfo.type) {
    case 'about':
      // Extract description if not already found
      if (!businessData.description) {
        businessData.description = await extractDescriptionFromPage(page);
      }
      // Look for company values
      const companyValues = await extractCompanyValues(page);
      if (companyValues.length > 0) {
        businessData.companyValues = companyValues;
      }
      break;
      
    case 'team':
      // Team extraction will be handled by text analysis
      break;
      
    case 'contact':
      // Address
      const address = await extractAddressFromPage(page);
      if (address) {
        businessData.address = address;
      }
      
      // Hours
      const hours = await extractBusinessHours(page);
      if (hours.length > 0) {
        businessData.hours = hours;
      }
      break;
      
    case 'services':
      // Extract services
      const services = await extractServices(page);
      if (services.length > 0) {
        businessData.services = services;
      }
      break;
  }
}

/**
 * Extract company values from a page
 */
async function extractCompanyValues(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const values: string[] = [];
    
    // Look for lists in about sections
    const valueSelectors = [
      '.values li',
      '.values-list li',
      '.mission-values li',
      '.company-values li',
      'section.values li',
      'h2:contains("Values"), h2:contains("Mission"), h2:contains("Philosophy"), h2:contains("Approach"), h2:contains("Values") + ul li'
    ];
    
    for (const selector of valueSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          for (const el of Array.from(elements)) {
            const text = el.textContent?.trim();
            if (text && text.length > 0) {
              values.push(text);
            }
          }
          if (values.length > 0) break;
        }
      } catch (error) {
        // Ignore errors for individual selectors
      }
    }
    
    return values;
  });
}

/**
 * Extract business hours from a page
 */
async function extractBusinessHours(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const hours: string[] = [];
    
    // Look for hours sections
    const hoursSelectors = [
      '.hours li',
      '.business-hours li',
      '.opening-hours li',
      '.schedule li',
      'table.hours tr',
      '.hours p',
      'h2:contains("Hours"), h3:contains("Hours"), h4:contains("Hours")'
    ];
    
    for (const selector of hoursSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          for (const el of Array.from(elements)) {
            const text = el.textContent?.trim();
            if (text && text.length > 0 && 
                (text.includes('Monday') || 
                 text.includes('Tuesday') || 
                 text.includes('Wednesday') || 
                 text.includes('Thursday') || 
                 text.includes('Friday') || 
                 text.includes('Saturday') || 
                 text.includes('Sunday') || 
                 text.includes('Mon') || 
                 text.includes('Tue') || 
                 text.includes('Wed') || 
                 text.includes('Thu') || 
                 text.includes('Fri') || 
                 text.includes('Sat') || 
                 text.includes('Sun'))) {
              hours.push(text);
            }
          }
          if (hours.length > 0) break;
        }
      } catch (error) {
        // Ignore errors for individual selectors
      }
    }
    
    return hours;
  });
}

/**
 * Extract address from a page
 */
async function extractAddressFromPage(page: Page): Promise<string | undefined> {
  return await page.evaluate(() => {
    // Look for address sections
    const addressSelectors = [
      '.address',
      '.location address',
      '.contact-info address',
      'address',
      'p:contains("Street"), p:contains("Avenue"), p:contains("Drive"), p:contains("Road"), p:contains("Lane"), p:contains("Blvd")'
    ];
    
    for (const selector of addressSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          const text = elements[0].textContent?.trim();
          if (text && text.length > 10) {
            return text;
          }
        }
      } catch (error) {
        // Ignore errors for individual selectors
      }
    }
    
    return undefined;
  });
}

/**
 * Extract services from a page
 */
async function extractServices(page: Page): Promise<Array<{ name: string; description?: string; price?: string }>> {
  return await page.evaluate(() => {
    const services: Array<{ name: string; description?: string; price?: string }> = [];
    
    // Look for service sections
    const serviceSelectors = [
      '.service',
      '.services li',
      '.services-list li',
      '.service-item',
      '.treatment',
      '.treatment-item',
      '.procedure',
      '.procedure-item'
    ];
    
    for (const selector of serviceSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          for (const el of Array.from(elements)) {
            // Find name (usually a heading)
            let name = '';
            let description = '';
            let price = '';
            
            const heading = el.querySelector('h2, h3, h4, h5, strong, b');
            if (heading) {
              name = heading.textContent?.trim() || '';
              
              // Look for description
              const desc = el.querySelector('p');
              if (desc && desc !== heading) {
                description = desc.textContent?.trim() || '';
              } else {
                // Get text nodes that aren't inside the heading
                const clone = el.cloneNode(true) as HTMLElement;
                heading.remove();
                description = clone.textContent?.trim() || '';
              }
            } else {
              // If no heading, try to find a structure
              name = el.textContent?.trim() || '';
              if (name.includes(':')) {
                const parts = name.split(':');
                name = parts[0].trim();
                description = parts.slice(1).join(':').trim();
              }
            }
            
            // Look for price
            const priceMatch = el.textContent?.match(/\$\d+(?:\.\d{2})?|\d+\s*(?:dollars|USD)/i);
            if (priceMatch) {
              price = priceMatch[0];
            }
            
            if (name) {
              services.push({ 
                name, 
                description: description || undefined,
                price: price || undefined
              });
            }
          }
          
          if (services.length > 0) break;
        }
      } catch (error) {
        // Ignore errors for individual selectors
      }
    }
    
    // Fallback - look for any list items that might be services
    if (services.length === 0) {
      const lists = document.querySelectorAll('ul, ol');
      for (const list of Array.from(lists)) {
        if (services.length > 0) break;
        
        // Check if parent or nearby heading suggests services
        let parent = list.parentElement;
        let isServiceList = false;
        
        while (parent && !isServiceList) {
          const headings = parent.querySelectorAll('h1, h2, h3, h4, h5, h6');
          for (const heading of Array.from(headings)) {
            const headingText = heading.textContent?.toLowerCase() || '';
            if (
              headingText.includes('service') || 
              headingText.includes('treatment') || 
              headingText.includes('procedure') || 
              headingText.includes('offer') || 
              headingText.includes('provide')
            ) {
              isServiceList = true;
              break;
            }
          }
          parent = parent.parentElement;
        }
        
        if (isServiceList) {
          const items = list.querySelectorAll('li');
          for (const item of Array.from(items)) {
            const name = item.textContent?.trim() || '';
            if (name) {
              services.push({ name });
            }
          }
        }
      }
    }
    
    return services;
  });
} 