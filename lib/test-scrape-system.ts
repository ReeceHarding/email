import 'dotenv/config';
import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { delay } from './utils';

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

const API_KEY = process.env.SCRAPING_BEE_API_KEY!;

export interface BusinessInfo {
  name?: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  hours?: string[];
  services?: Array<{
    name: string;
    description?: string;
    price?: string;
  }>;
  socialLinks: {
    facebook: string;
    instagram: string;
    twitter: string;
    linkedin: string;
    youtube: string;
    [key: string]: string;
  };
}

export async function scrapeUrl(url: string): Promise<BusinessInfo> {
  const info: BusinessInfo = {
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    website: url,
    hours: [],
    services: [],
    socialLinks: {
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
      youtube: ''
    }
  };

  try {
    const html = await fetchWithRetry(url);
    const $ = cheerio.load(html);

    // Extract business name
    info.name = $('h1').first().text().trim() || 
                $('.site-title').text().trim() ||
                $('meta[property="og:site_name"]').attr('content') ||
                $('title').text().trim().split('|')[0].trim();

    // Extract description
    info.description = $('meta[name="description"]').attr('content') ||
                      $('meta[property="og:description"]').attr('content') ||
                      $('.site-description').text().trim();

    // Extract contact information
    $('a[href^="tel:"]').each((_, el) => {
      const phone = $(el).attr('href')?.replace('tel:', '');
      if (phone) {
        info.phone = phone;
      }
    });

    // Extract email addresses
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const emailMatches = html.match(emailPattern);
    if (emailMatches && emailMatches.length > 0) {
      info.email = emailMatches[0].toLowerCase();
    }

    // Extract address
    const addressSelectors = [
      '.address',
      '[itemtype*="PostalAddress"]',
      '.location',
      '.contact-info address',
      '[class*="address"]'
    ];

    for (const selector of addressSelectors) {
      const addressText = $(selector).text().trim();
      if (addressText && !addressText.includes('--wp--')) {
        info.address = addressText;
        break;
      }
    }

    // Extract hours
    const hoursSelectors = [
      '.hours',
      '.business-hours',
      '.opening-hours',
      '[class*="hours"]',
      '[itemtype*="OpeningHoursSpecification"]'
    ];

    for (const selector of hoursSelectors) {
      $(selector).find('li, tr, div').each((_, el) => {
        const text = $(el).text().trim();
        if (text && !text.includes('--wp--') && /(?:mon|tue|wed|thu|fri|sat|sun)/i.test(text)) {
          info.hours?.push(text);
        }
      });
    }

    // Extract services
    const serviceSelectors = [
      '.services',
      '.menu-items',
      '[class*="service"]',
      '[class*="treatment"]'
    ];

    for (const selector of serviceSelectors) {
      $(selector).find('li, .item, article').each((_, el) => {
        const $el = $(el);
        const name = $el.find('h3, h4, .name, .title').text().trim() || $el.text().trim();
        const price = $el.find('.price, [class*="price"]').text().trim();
        const description = $el.find('.description, [class*="description"]').text().trim();

        if (name && !name.includes('--wp--')) {
          info.services?.push({
            name,
            price: price || undefined,
            description: description || undefined
          });
        }
      });
    }

    // Extract social media links
    const socialPatterns = {
      facebook: /facebook\.com\/[a-zA-Z0-9.]+/,
      twitter: /twitter\.com\/[a-zA-Z0-9_]+/,
      instagram: /instagram\.com\/[a-zA-Z0-9_]+/,
      linkedin: /linkedin\.com\/(?:company|in)\/[a-zA-Z0-9-]+/
    };

    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        Object.entries(socialPatterns).forEach(([platform, pattern]) => {
          if (pattern.test(href)) {
            if (!info.socialLinks) {
              info.socialLinks = {
                facebook: '',
                instagram: '',
                twitter: '',
                linkedin: '',
                youtube: ''
              };
            }
            info.socialLinks[platform] = href;
          }
        });
      }
    });

    return info;
  } catch (error) {
    console.error('Error scraping URL:', error);
    return info;
  }
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0'
};

async function fetchWithRetry(url: string, maxRetries = 3): Promise<string> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: BROWSER_HEADERS,
        timeout: 10000,
        maxRedirects: 5
      });
      return response.data;
    } catch (error) {
      lastError = error as Error;
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        
        // Don't retry on these status codes and provide clearer messages
        if (status === 404) {
          // Skip logging for 404s since they're expected during discovery
          throw new Error(`Page not found (404)`);
        } else if (status === 403) {
          console.log(`Access forbidden (403) for ${url}`);
          throw new Error(`Access forbidden (403)`);
        } else if (status === 401) {
          console.log(`Authentication required (401) for ${url}`);
          throw new Error(`Authentication required (401)`);
        }
        
        // Add delay between retries
        if (attempt < maxRetries) {
          const delayMs = attempt * 2000; // Exponential backoff
          console.log(`Temporary error (${status}). Retrying in ${delayMs/1000} seconds...`);
          await delay(delayMs);
        }
      }
    }
  }
  
  throw lastError || new Error('Failed to fetch URL after multiple attempts');
}

let mockScrapeFunction: ((url: string) => Promise<BusinessInfo>) | undefined;

export function setMockScrapeFunction(mock: (url: string) => Promise<BusinessInfo>) {
  mockScrapeFunction = mock;
}

export function clearMockScrapeFunction() {
  mockScrapeFunction = undefined;
}

async function testScrapeSystem(url: string) {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    // Extract base URL
    const baseUrl = new URL(url).origin;
    
    // Common pages to check
    const pagesToCheck = [
      url, // Original URL
      `${baseUrl}/index.html`,
      `${baseUrl}/contact.html`,
      `${baseUrl}/about.html`,
      `${baseUrl}/services.html`,
      `${baseUrl}/contact`,
      `${baseUrl}/about`,
      `${baseUrl}/services`,
      `${baseUrl}/about-us`,
      `${baseUrl}/our-services`,
      `${baseUrl}/meet-the-doctor`,
      `${baseUrl}/meet-dr`,
      `${baseUrl}/our-practice`,
      `${baseUrl}/office-information`,
      `${baseUrl}/patient-information`,
      `${baseUrl}/new-patients`,
      `${baseUrl}/dental-services`,
      `${baseUrl}/family-dentistry`,
      `${baseUrl}/general-dentistry`,
      `${baseUrl}/cosmetic-dentistry`,
      `${baseUrl}/emergency-dentistry`,
      `${baseUrl}/insurance`,
      `${baseUrl}/insurance-information`,
      `${baseUrl}/payment-options`,
      `${baseUrl}/location`,
      `${baseUrl}/directions`,
      `${baseUrl}/hours`
    ];

    // Combined business info
    let combinedInfo: BusinessInfo = {
      name: '',
      description: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      hours: [],
      services: [],
      socialLinks: {
        facebook: '',
        instagram: '',
        twitter: '',
        linkedin: '',
        youtube: ''
      }
    };
    
    // Try each page
    for (const pageUrl of pagesToCheck) {
      const pageInfo = await scrapeUrl(pageUrl);
      
      // Merge information
      combinedInfo = {
        name: combinedInfo.name || pageInfo.name,
        description: combinedInfo.description || pageInfo.description,
        address: combinedInfo.address || pageInfo.address,
        phone: combinedInfo.phone || pageInfo.phone,
        email: combinedInfo.email || pageInfo.email,
        website: combinedInfo.website || pageInfo.website,
        hours: combinedInfo.hours || pageInfo.hours,
        services: [...(combinedInfo.services || []), ...(pageInfo.services || [])],
        socialLinks: { ...(combinedInfo.socialLinks || {}), ...(pageInfo.socialLinks || {}) }
      };

      // Wait between requests
      await delay(2000);
    }

    // Display results
    console.log('\nExtracted Business Information:');
    console.log('=============================');
    
    if (combinedInfo.name) console.log('Practice Name:', combinedInfo.name);
    if (combinedInfo.description) console.log('Description:', combinedInfo.description);
    
    console.log('\nContact Information:');
    console.log('-------------------');
    if (combinedInfo.address) console.log('Full Address:', combinedInfo.address);
    if (combinedInfo.phone) console.log('Phone:', combinedInfo.phone);
    if (combinedInfo.email) console.log('Email:', combinedInfo.email);
    
    if (combinedInfo.hours && combinedInfo.hours.length > 0) {
      console.log('\nBusiness Hours:');
      console.log('---------------');
      combinedInfo.hours.forEach(hour => console.log(`- ${hour}`));
    }
    
    if (combinedInfo.services && combinedInfo.services.length > 0) {
      console.log('\nServices:');
      console.log('---------');
      combinedInfo.services.forEach(service => console.log(`- ${service.name} (${service.price})`));
    }

    if (combinedInfo.socialLinks && Object.keys(combinedInfo.socialLinks).length > 0) {
      console.log('\nSocial Media:');
      console.log('-------------');
      Object.entries(combinedInfo.socialLinks).forEach(([platform, url]) => {
        console.log(`- ${platform}: ${url}`);
      });
    }

    return combinedInfo;
  } catch (error: any) {
    console.error('Error:', error.message);
    throw error;
  }
}

async function extractBusinessInfo(html: string): Promise<BusinessInfo> {
  const info: BusinessInfo = {
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    hours: [],
    services: [],
    socialLinks: {
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
      youtube: ''
    }
  };

  // Extract business name from Instagram header
  const nameMatch = html.match(/<h3>([^<]+)<\/h3>/);
  if (nameMatch) {
    info.name = nameMatch[1].trim();
  }

  // Extract description from Instagram bio
  const bioMatch = html.match(/<p class="sbi_bio">([^<]+)<\/p>/);
  if (bioMatch) {
    info.description = bioMatch[1].replace(/<br>/g, ' ').trim();
  }

  // Extract social media links
  const socialMatches = {
    facebook: html.match(/href="(https:\/\/(?:www\.)?facebook\.com\/[^"]+)"/),
    instagram: html.match(/href="(https:\/\/(?:www\.)?instagram\.com\/[^"]+)"/),
    youtube: html.match(/href="(https:\/\/(?:www\.)?youtube\.com\/[^"]+)"/)
  };

  if (socialMatches.facebook) info.socialLinks.facebook = socialMatches.facebook[1];
  if (socialMatches.instagram) info.socialLinks.instagram = socialMatches.instagram[1];
  if (socialMatches.youtube) info.socialLinks.youtube = socialMatches.youtube[1];

  // Extract phone number
  const phoneMatch = html.match(/tel:([^"]+)/);
  if (phoneMatch) {
    info.phone = phoneMatch[1];
  }

  // Extract email using a more robust pattern
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi;
  const emailMatches = html.match(emailPattern);
  if (emailMatches && emailMatches.length > 0) {
    info.email = emailMatches[0];
  }

  // Set website
  info.website = 'https://thespotbarbershop.com/';

  return info;
}

// Only run if this is the main module
if (require.main === module) {
  const TEST_URL = process.argv[2] || 'https://about.google';
  testScrapeSystem(TEST_URL).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });
} 