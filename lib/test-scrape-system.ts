import 'dotenv/config';
import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { delay } from './utils';

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

const API_KEY = process.env.SCRAPING_BEE_API_KEY!;

export interface TeamMember {
    name: string;
    role?: string;
    bio?: string;
  image?: string;
  email?: string;
  phone?: string;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    [key: string]: string | undefined;
  };
}

export interface Award {
  name: string;
  year?: string;
  description?: string;
}

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
  teamMembers?: TeamMember[];
  foundingYear?: string;
  companyValues?: string[];
  missionStatement?: string;
  awards?: Award[];
    certifications?: string[];
  industries?: string[];
  specialties?: string[];
  partnerships?: string[];
  locations?: Array<{
    name?: string;
    address: string;
    phone?: string;
    email?: string;
    hours?: string[];
  }>;
  blogPosts?: Array<{
    title: string;
    url: string;
    date?: string;
    excerpt?: string;
  }>;
  pressReleases?: Array<{
    title: string;
    date: string;
    url?: string;
    content?: string;
  }>;
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
    },
    teamMembers: [],
    companyValues: [],
      certifications: [],
    industries: [],
    specialties: [],
    partnerships: [],
    locations: [],
    blogPosts: [],
    pressReleases: []
  };

  try {
    const html = await fetchWithRetry(url);
  const $ = cheerio.load(html);

    // Extract structured data
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const data = JSON.parse($(element).html() || '{}');
        if (data['@type'] === 'LocalBusiness' || data['@type'] === 'Organization') {
          info.name = data.name || info.name;
          info.description = data.description || info.description;
          info.address = data.address?.streetAddress || data.address || info.address;
          info.phone = data.telephone || info.phone;
          info.email = data.email || info.email;
          info.foundingYear = data.foundingDate?.split('-')[0] || info.foundingYear;
          
          if (data.openingHours) {
            info.hours = Array.isArray(data.openingHours) 
              ? data.openingHours 
              : [data.openingHours];
          }

          if (data.hasOfferCatalog?.itemListElement) {
            info.services = data.hasOfferCatalog.itemListElement.map((item: any) => ({
              name: item.name || '',
              description: item.description,
              price: item.offers?.price
            }));
          }

          if (data.sameAs) {
            const socialUrls: string[] = Array.isArray(data.sameAs) ? data.sameAs : [data.sameAs];
            socialUrls.forEach((url: string) => {
              if (url.includes('facebook.com')) info.socialLinks.facebook = url;
              if (url.includes('instagram.com')) info.socialLinks.instagram = url;
              if (url.includes('twitter.com')) info.socialLinks.twitter = url;
              if (url.includes('linkedin.com')) info.socialLinks.linkedin = url;
              if (url.includes('youtube.com')) info.socialLinks.youtube = url;
            });
          }
        }

        // Look for team members in structured data
        if (data['@type'] === 'Person' && data.memberOf?.['@type'] === 'Organization') {
          info.teamMembers?.push({
            name: data.name,
            role: data.jobTitle,
            bio: data.description,
            image: data.image,
            email: data.email,
            phone: data.telephone,
            socialLinks: {
              linkedin: data.sameAs?.find((url: string) => url.includes('linkedin.com')),
              twitter: data.sameAs?.find((url: string) => url.includes('twitter.com'))
            }
          });
        }
      } catch (error) {
        // Ignore JSON parsing errors
      }
    });

    // Extract meta tags with improved business name extraction
    if (!info.name) {
      // Try structured data first
      const structuredData = $('script[type="application/ld+json"]')
        .map((_, el) => {
          try {
            return JSON.parse($(el).html() || '{}');
          } catch {
            return {};
          }
        })
        .get()
        .find(data => data['@type'] === 'LocalBusiness' || data['@type'] === 'Organization' || data['@type'] === 'Restaurant');

      if (structuredData?.name) {
        info.name = structuredData.name;
      } else {
        // Try various selectors in order of reliability
        const possibleNames = [
          $('meta[property="og:site_name"]').attr('content'),
          $('meta[property="og:title"]').attr('content')?.split(/[|\-–—]/).map(s => s.trim())[0],
          $('[itemtype*="LocalBusiness"] [itemprop="name"]').text().trim(),
          $('[itemtype*="Organization"] [itemprop="name"]').text().trim(),
          $('[class*="business-name"]').text().trim(),
          $('[class*="company-name"]').text().trim(),
          $('[class*="brand-name"]').text().trim(),
          $('[class*="site-title"]').text().trim(),
          $('h1').first().text().trim(),
          $('title').text().trim().split(/[|\-–—]/).map(s => s.trim())[0],
          $('[class*="logo"] img').attr('alt'),
          $('[class*="brand"] img').attr('alt')
        ].filter(name => 
          name && 
          name.length > 1 && 
          !name.includes('--wp--') &&
          !/^(home|welcome|index|main|select|menu)$/i.test(name)
        );

        info.name = possibleNames[0] || '';
      }
    }

    if (!info.description) {
      info.description = $('meta[name="description"]').attr('content') ||
                        $('meta[property="og:description"]').attr('content') ||
                        $('[class*="hero"] p').first().text().trim() ||
                        $('[class*="intro"] p').first().text().trim() ||
                        $('[class*="about"] p').first().text().trim();
    }

    // Extract services with better selectors
    if (!info.services?.length) {
      $('[class*="service"], [class*="menu-item"], [class*="product"], .service, .menu-item, .product').each((_, el) => {
        const $el = $(el);
        const name = $el.find('h2, h3, h4, [class*="title"], [class*="name"]').first().text().trim();
        const description = $el.find('p, [class*="description"]').first().text().trim();
        const price = $el.find('[class*="price"]').first().text().trim();

        if (name && !name.includes('--wp--')) {
          info.services?.push({
          name,
            description: description || undefined,
            price: price || undefined
          });
        }
      });
    }

    // Extract team members with better selectors
    $('.team-member, .staff-member, .employee, [class*="team"] > div, [class*="staff"] > div, [class*="doctor"], [class*="provider"]').each((_, el) => {
      const $el = $(el);
      const name = $el.find('h2, h3, h4, [class*="name"]').first().text().trim();
      const role = $el.find('[class*="title"], [class*="position"], [class*="role"], [class*="specialty"]').first().text().trim();
      const bio = $el.find('[class*="bio"], [class*="description"], p').first().text().trim();
      const image = $el.find('img').attr('src');
      const email = $el.find('a[href^="mailto:"]').attr('href')?.replace('mailto:', '');
      const phone = $el.find('a[href^="tel:"]').attr('href')?.replace('tel:', '');

      if (name) {
        info.teamMembers?.push({
          name,
          role: role || undefined,
          bio: bio || undefined,
          image: image || undefined,
          email: email || undefined,
          phone: phone || undefined
        });
      }
    });

    // Extract contact information with better patterns
    if (!info.phone) {
      const phonePattern = /(\+?1[-.]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})/g;
      const phones = html.match(phonePattern);
      if (phones) {
        info.phone = phones[0].replace(/[-.()\s]/g, '');
      }
    }

    if (!info.email) {
      const emailPattern = /\b[A-Za-z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}\b/g;
      const emailMatches = html.match(emailPattern);
      if (emailMatches) {
        const validEmails = emailMatches.filter(email => 
          !email.includes('.png') && 
          !email.includes('.jpg') && 
          !email.includes('.gif') &&
          !email.includes('.svg') &&
          !email.includes('@2x') &&
          !email.includes('@3x') &&
          !email.includes('example.com') &&
          !email.includes('domain.com') &&
          !email.includes('yourdomain.com')
        );
        if (validEmails.length > 0) {
          info.email = validEmails[0].toLowerCase();
        }
      }
    }

    // Extract address with better patterns
    if (!info.address) {
      $('[itemtype*="PostalAddress"], [class*="address"], address, [class*="location"] address').each((_, el) => {
        const addressText = $(el).text().trim();
        if (addressText && 
            !addressText.includes('--wp--') && 
            /\d+.*(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)/i.test(addressText)) {
          info.address = addressText;
          return false; // break the loop
        }
      });
    }

    // Extract hours with better patterns
    if (!info.hours?.length) {
      $('[class*="hours"], [class*="schedule"], [class*="time"], [itemtype*="OpeningHoursSpecification"]').each((_, el) => {
        const $el = $(el);
        $el.find('tr, li').each((_, item) => {
          const text = $(item).text().trim();
          if (text && 
              /(?:mon|tue|wed|thu|fri|sat|sun)/i.test(text) && 
              /(?:\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)/i.test(text) &&
              !text.includes('--wp--')) {
            info.hours?.push(text);
          }
        });
      });
    }

    // Extract social media links with better patterns
    if (!Object.values(info.socialLinks).some(link => link)) {
      $('a[href*="facebook.com"], a[href*="instagram.com"], a[href*="twitter.com"], a[href*="linkedin.com"], a[href*="youtube.com"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          if (href.includes('facebook.com')) info.socialLinks.facebook = href;
          if (href.includes('instagram.com')) info.socialLinks.instagram = href;
          if (href.includes('twitter.com')) info.socialLinks.twitter = href;
          if (href.includes('linkedin.com')) info.socialLinks.linkedin = href;
          if (href.includes('youtube.com')) info.socialLinks.youtube = href;
        }
      });
    }

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