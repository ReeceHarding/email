import 'dotenv/config';
import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { delay } from './utils';
import Firecrawl from '@mendable/firecrawl-js';
import { CheerioAPI } from 'cheerio';
import type { Element as CheerioElement } from 'cheerio';

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY!;

if (!FIRECRAWL_API_KEY) {
  throw new Error('FIRECRAWL_API_KEY is not set in environment variables');
}

const firecrawl = new Firecrawl({
  apiKey: FIRECRAWL_API_KEY
});

// Fallback options for when Firecrawl fails
const COMPANY_INFO_ENDPOINTS = {
  hubspot: {
    team: 'https://www.hubspot.com/company/management',
    about: 'https://www.hubspot.com/our-story'
  },
  salesforce: {
    team: 'https://www.salesforce.com/company/leadership/',
    about: 'https://www.salesforce.com/company/about-us/'
  }
};

export interface TeamMember {
  name: string;
  role?: string;
  description?: string;
  image?: string;
  email?: string;
  telephone?: string;
}

export interface Award {
  name: string;
  year?: string;
  description?: string;
}

export interface BusinessInfo {
  name: string;
  description?: string;
  contactInfo?: ContactInfo;
  socialLinks?: SocialLink[];
  teamMembers?: TeamMember[];
  website?: string;
  address?: string;
  phone?: string;
  email?: string;
  hours?: string[];
  services?: string[];
  pressReleases?: string[];
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
}

interface BusinessType {
  type: string;
  selectors: {
    name: string[];
    team: string[];
    about: string[];
    contact: string[];
    services: string[];
  };
  sitemapPatterns: string[];
  teamTitles: string[];
}

const BUSINESS_TYPES: Record<string, BusinessType> = {
  dental: {
    type: 'dental',
    selectors: {
      name: ['.practice-name', '[class*="practice-name"]', '.dental-practice', '[class*="dental"]'],
      team: ['.doctor', '.dentist', '.dental-team', '[class*="doctor"]', '[class*="dentist"]'],
      about: ['.practice-info', '.dental-practice', '.about-practice'],
      contact: ['.contact-info', '.practice-contact', '.dental-contact'],
      services: ['.dental-services', '.treatments', '.procedures']
    },
    sitemapPatterns: ['doctor-sitemap.xml', 'dentist-sitemap.xml', 'team-sitemap.xml'],
    teamTitles: ['DDS', 'DMD', 'Dentist', 'Orthodontist', 'Dental Hygienist']
  },
  chiropractic: {
    type: 'chiropractic',
    selectors: {
      name: ['.practice-name', '[class*="chiro"]', '.clinic-name', '.office-name'],
      team: [
        '.chiropractor', 
        '.doctor', 
        '.practitioner', 
        '[class*="chiropractor"]',
        '[class*="doctor"]',
        '[class*="provider"]',
        '[class*="team"]',
        '[class*="staff"]'
      ],
      about: ['.practice-info', '.clinic-info', '.about-practice', '.about-us'],
      contact: ['.contact-info', '.clinic-contact', '.office-contact'],
      services: ['.treatments', '.adjustments', '.services', '.care']
    },
    sitemapPatterns: ['provider-sitemap.xml', 'doctor-sitemap.xml', 'team-sitemap.xml'],
    teamTitles: ['DC', 'Chiropractor', 'LMT', 'Massage Therapist', 'Doctor of Chiropractic', 'Chiropractic Assistant']
  },
  contractor: {
    type: 'contractor',
    selectors: {
      name: ['.company-name', '[class*="contractor"]', '.business-name'],
      team: ['.contractor', '.team-member', '.staff', '[class*="contractor"]'],
      about: ['.company-info', '.about-us', '.business-info'],
      contact: ['.contact-info', '.business-contact'],
      services: ['.services', '.projects', '.work']
    },
    sitemapPatterns: ['team-sitemap.xml', 'staff-sitemap.xml'],
    teamTitles: ['Owner', 'Contractor', 'Project Manager', 'Estimator']
  },
  software: {
    type: 'software',
    selectors: {
      name: ['.company-name', '[class*="software"]', '.business-name'],
      team: ['.team-member', '.employee', '.engineer', '[class*="developer"]'],
      about: ['.company-info', '.about-us', '.business-info'],
      contact: ['.contact-info', '.business-contact'],
      services: ['.products', '.solutions', '.services']
    },
    sitemapPatterns: ['team-sitemap.xml', 'about-sitemap.xml'],
    teamTitles: ['Engineer', 'Developer', 'CTO', 'Architect', 'Product Manager']
  }
};

async function detectBusinessType($: CheerioAPI): Promise<BusinessType> {
  // Get all text content
  const pageText = $('body').text().toLowerCase();
  const metaKeywords = $('meta[name="keywords"]').attr('content')?.toLowerCase() || '';
  const metaDescription = $('meta[name="description"]').attr('content')?.toLowerCase() || '';
  const title = $('title').text().toLowerCase();
  
  // Score each business type based on keyword matches
  const scores = Object.entries(BUSINESS_TYPES).map(([_, type]) => {
    let score = 0;
    
    // Check title keywords with higher weight
    type.teamTitles.forEach(title => {
      const lowerTitle = title.toLowerCase();
      if (pageText.includes(lowerTitle)) score += 3;
      if (metaKeywords.includes(lowerTitle)) score += 4;
      if (metaDescription.includes(lowerTitle)) score += 3;
      if (title.includes(lowerTitle)) score += 5;
    });
    
    // Check for business-specific keywords
    if (type.type === 'chiropractic') {
      const chiroKeywords = ['chiropractic', 'adjustment', 'spine', 'spinal', 'wellness', 'alignment'];
      chiroKeywords.forEach(keyword => {
        if (pageText.includes(keyword)) score += 2;
        if (metaKeywords.includes(keyword)) score += 3;
        if (metaDescription.includes(keyword)) score += 2;
        if (title.includes(keyword)) score += 4;
      });
    }
    
    // Check selectors
    Object.values(type.selectors).flat().forEach(selector => {
      if ($(selector).length > 0) score += 2;
    });
    
    return { type, score };
  });
  
  // Return the type with highest score
  const bestMatch = scores.reduce((best, current) => 
    current.score > best.score ? current : best
  );
  
  console.log('Business type scores:', scores.map(s => `${s.type.type}: ${s.score}`).join(', '));
  return bestMatch.type;
}

interface Person {
  name: string;
  role?: string;
  details?: string;  // Any additional context about the person
  imageUrl?: string;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    instagram?: string;
    email?: string;
  };
}

interface ScrapedContent {
  url: string;
  rawText: string;  // All text content from the page
  people: Person[];  // People identified on the page
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

interface FirecrawlError {
  message: string;
  code?: string;
  details?: any;
}

interface FirecrawlResponse {
  success: boolean;
  error?: FirecrawlError;
  html?: string;
  markdown?: string;
  metadata?: Record<string, any>;
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<string> {
  let lastError: Error | null = null;
  
  // Try axios first
  try {
    console.log(`Trying direct axios fetch for ${url}...`);
    const axiosResponse = await axios.get(url, {
      headers: {
        ...BROWSER_HEADERS,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });
    console.log(`Successfully fetched ${url} via axios`);
    return axiosResponse.data;
  } catch (axiosError) {
    console.error('Axios fetch failed:', axiosError);
  }
  
  // If axios fails, try Firecrawl
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}: Fetching ${url} via Firecrawl...`);
      
      const response = await firecrawl.scrapeUrl(url, {
        formats: ['html'],
        proxy: attempt === 1 ? 'stealth' : 'basic',
        waitFor: 5000,
        headers: BROWSER_HEADERS
      }) as FirecrawlResponse;

      if (!response.success || !response.html) {
        throw new Error(response.error?.message || 'No HTML content returned');
      }

      console.log(`Successfully fetched ${url} via Firecrawl`);
      return response.html;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Firecrawl error on attempt ${attempt}:`, error);
      
      if (attempt < maxRetries) {
        const delayMs = attempt * 2000;
        console.log(`Retrying in ${delayMs/1000} seconds...`);
        await delay(delayMs);
      }
    }
  }
  
  throw lastError || new Error('Failed to fetch URL after multiple attempts');
}

let mockScrapeFunction: ((url: string) => Promise<ScrapedContent>) | undefined;

export function setMockScrapeFunction(mock: (url: string) => Promise<ScrapedContent>) {
  mockScrapeFunction = mock;
}

export function clearMockScrapeFunction() {
  mockScrapeFunction = undefined;
}

async function testScrapeSystem(url: string): Promise<Record<string, ScrapedContent>> {
  try {
    // Extract base URL
    const baseUrl = new URL(url).origin;
    const results: Record<string, ScrapedContent> = {};
    const visited = new Set<string>();
    const toVisit = new Set<string>([url]);
    
    while (toVisit.size > 0) {
      const pageUrl = Array.from(toVisit)[0];
      toVisit.delete(pageUrl);
      
      if (visited.has(pageUrl)) continue;
      visited.add(pageUrl);
      
      try {
        console.log(`\nScraping: ${pageUrl}`);
        const html = await fetchWithRetry(pageUrl);
        if (!html) continue;
        
        const $ = cheerio.load(html);
        
        // Collect new links before scraping content
        $('a').each((_, el) => {
          const href = $(el).attr('href');
          if (href) {
            try {
              const fullUrl = new URL(href, baseUrl).toString();
              if (fullUrl.startsWith(baseUrl) && !visited.has(fullUrl)) {
                // Check if this looks like a team-related page
                const linkText = $(el).text().toLowerCase();
                const hrefLower = href.toLowerCase();
                const isTeamRelated = 
                  linkText.includes('team') || 
                  linkText.includes('staff') || 
                  linkText.includes('about') ||
                  linkText.includes('doctor') ||
                  linkText.includes('provider') ||
                  hrefLower.includes('team') ||
                  hrefLower.includes('staff') ||
                  hrefLower.includes('about') ||
                  hrefLower.includes('doctor') ||
                  hrefLower.includes('provider');
                
                if (isTeamRelated) {
                  console.log(`Found potential team-related link: ${fullUrl}`);
                  // Prioritize team-related pages by adding them first
                  toVisit.add(fullUrl);
                } else {
                  // Add other pages to be visited later
                  toVisit.add(fullUrl);
                }
              }
            } catch (e) {
              // Invalid URL, skip it
            }
          }
        });
        
        // Analyze the current page
        const content = await scrapeUrl(pageUrl);
        if (content) {
          results[pageUrl] = content;
          console.log(`Successfully scraped ${pageUrl}`);
          if (content.people.length > 0) {
            console.log(`Found ${content.people.length} people:`);
            content.people.forEach(person => {
              console.log(`- ${person.name}${person.role ? ` (${person.role})` : ''}`);
              if (person.details) console.log(`  Details: ${person.details.substring(0, 100)}...`);
            });
          }
        }
        
        // Add delay between requests
        await delay(3000);
        
      } catch (error) {
        console.error(`Error scraping ${pageUrl}:`, error);
      }
    }

    return results;
  } catch (error: unknown) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Only run if this is the main module
if (require.main === module) {
  const TEST_URL = process.argv[2] || 'https://about.google';
  testScrapeSystem(TEST_URL).catch((error: unknown) => {
    console.error('Test error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

function extractName($: CheerioAPI, businessType: BusinessType): string {
  // Try business-specific selectors first
  for (const selector of businessType.selectors.name) {
    const name = $(selector).text().trim();
    if (name) return name;
  }
  
  // Fallback to generic selectors
  return $('meta[property="og:site_name"]').attr('content')?.trim() ||
         $('title').text().trim().split(/[|\-]/).shift()?.trim() ||
         '';
}

function extractDescription($: CheerioAPI, businessType: BusinessType): string | undefined {
  return $('.site-description').text().trim() ||
         $('meta[name="description"]').attr('content') ||
         undefined;
}

interface SocialLink {
  platform: string;
  url: string;
}

function extractSocialLinks($: CheerioAPI): SocialLink[] {
  const socialLinks: SocialLink[] = [];
  
  // Common social media selectors
  const selectors = [
    'a[href*="facebook.com"]',
    'a[href*="twitter.com"]',
    'a[href*="instagram.com"]',
    'a[href*="linkedin.com"]',
    'a[href*="youtube.com"]',
    'a[href*="pinterest.com"]',
    '.social-links a',
    '[class*="social"] a'
  ];
  
  selectors.forEach(selector => {
    $(selector).each((_, element) => {
      const url = $(element).attr('href');
      if (url) {
        const platform = url.toLowerCase().match(/(?:facebook|twitter|instagram|linkedin|youtube|pinterest)/)?.[0] || 'other';
        socialLinks.push({ platform, url });
      }
    });
  });
  
  return socialLinks;
}

interface ContactInfo {
  phone?: string;
  email?: string;
  address?: string;
}

function extractContactInfo($: CheerioAPI): ContactInfo | undefined {
  const info: ContactInfo = {};
  
  // Phone - look in more places
  $('a[href^="tel:"], [class*="phone"], .phone, .contact-phone').each((_, el) => {
    const $el = $(el);
    const phone = $el.attr('href')?.replace('tel:', '') || 
                 $el.text().trim().match(/\(?[0-9]{3}\)?[-. ]?[0-9]{3}[-. ]?[0-9]{4}/)?.[0];
    if (phone) info.phone = phone;
  });
  
  // Email - look in more places
  $('a[href^="mailto:"], [class*="email"], .email, .contact-email').each((_, el) => {
    const $el = $(el);
    const email = $el.attr('href')?.replace('mailto:', '') || 
                 $el.text().trim().match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0];
    if (email) info.email = email;
  });
  
  // Address - look in more places
  $('address, [class*="address"], .location, [itemtype*="PostalAddress"]').each((_, el) => {
    const address = $(el).text().trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n/g, ', '); // Replace newlines with commas
    if (address) info.address = address;
  });
  
  // Try to find address in Google Maps link
  $('a[href*="maps.google.com"], a[href*="goo.gl/maps"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const match = href.match(/q=([^&]+)/);
      if (match) {
        info.address = decodeURIComponent(match[1]).replace(/\+/g, ' ');
      }
    }
  });
  
  return Object.keys(info).length > 0 ? info : undefined;
}

async function extractTeamFromSitemap($: CheerioAPI, sitemapText: string, info: BusinessInfo, businessType: BusinessType) {
  const $sitemap = cheerio.load(sitemapText, { xmlMode: true });
  
  $sitemap('url').each((_, url) => {
    const loc = $sitemap(url).find('loc').text();
    const image = $sitemap(url).find('image\\:loc').text();
    
    if (loc && image) {
      // Extract name from URL path segments
      const pathSegments = new URL(loc).pathname.split('/');
      const nameFromPath = pathSegments[pathSegments.length - 1]
        .replace(/-/g, ' ')
        .replace(/\/$/, '')
        .trim();
        
      if (nameFromPath) {
        const member: TeamMember = {
          name: nameFromPath,
          role: detectRole(nameFromPath, businessType),
          image
        };
        
        // Try to fetch team member bio
        fetchWithRetry(loc, 1).then(memberHtml => {
          if (memberHtml) {
            const $member = cheerio.load(memberHtml);
            const bio = extractBio($member, businessType);
            
            if (bio) {
              member.description = bio;
              console.log(`Bio for ${nameFromPath}:`, bio);
            }
          }
        }).catch(error => {
          console.error(`Error fetching bio for ${nameFromPath}:`, error);
        });
        
        console.log('Found team member in sitemap:', member);
        info.teamMembers?.push(member);
      }
    }
  });
}

function detectRole(name: string, businessType: BusinessType): string {
  const lowerName = name.toLowerCase();
  
  // Check for titles in name
  for (const title of businessType.teamTitles) {
    if (lowerName.includes(title.toLowerCase())) {
      return title;
    }
  }
  
  // Default role based on business type
  switch (businessType.type) {
    case 'dental':
      return 'Dentist';
    case 'chiropractic':
      return 'Chiropractor';
    case 'contractor':
      return 'Team Member';
    case 'software':
      return 'Team Member';
    default:
      return 'Team Member';
  }
}

function extractBio($: CheerioAPI, businessType: BusinessType): string {
  // Try business-specific selectors first
  for (const selector of businessType.selectors.about) {
    const bio = $(selector).text().trim();
    if (bio) return bio;
  }
  
  // Try generic bio selectors
  return $('.bio').text().trim() ||
         $('[class*="bio"]').text().trim() ||
         $('.description').text().trim() ||
         $('[class*="description"]').text().trim() ||
         $('.about').text().trim() ||
         $('[class*="about"]').text().trim() ||
         $('.entry-content p').text().trim();
}

// Replace the pageInfo section with direct info updates
async function extractPageInfo($: CheerioAPI, url: string, info: BusinessInfo): Promise<void> {
  try {
    const html = await fetchWithRetry(url);
    if (!html) return;

    const $page = cheerio.load(html);
    
    // Extract team members from the page
    const teamMembers = extractTeamMembers($page);
    if (teamMembers.length > 0) {
      console.log(`Found ${teamMembers.length} team members on page`);
      info.teamMembers = info.teamMembers || [];
      info.teamMembers.push(...teamMembers);
    }

    // Extract contact info
    const contactInfo = extractContactInfo($page);
    if (contactInfo) {
      info.contactInfo = contactInfo;
    }

    // Extract social links
    const socialLinks = extractSocialLinks($page);
    if (socialLinks.length > 0) {
      info.socialLinks = socialLinks;
    }
  } catch (error) {
    console.error(`Error extracting page info from ${url}:`, error);
  }
}

function extractTeamMembers($: CheerioAPI): TeamMember[] {
  const teamMembers: TeamMember[] = [];
  
  // Common team member container selectors
  const containerSelectors = [
    '.team-member',
    '.staff-member',
    '.doctor',
    '.provider',
    '.chiropractor',
    '[class*="team-member"]',
    '[class*="staff-member"]',
    '[class*="doctor"]',
    '[class*="provider"]',
    '[class*="chiropractor"]',
    // Generic containers that might contain team members
    '.team',
    '.staff',
    '.providers',
    '.doctors',
    '.about-us',
    '.meet-the-team',
    '.our-team'
  ];
  
  // First try direct team member elements
  containerSelectors.forEach(selector => {
    $(selector).each((_, element) => {
      const member = extractTeamMemberInfo($, element);
      if (member) teamMembers.push(member);
    });
  });
  
  // If no team members found, try looking for groups of similar elements
  if (teamMembers.length === 0) {
    // Find elements that contain both images and headings
    $('div,section,article').each((_, container) => {
      const $container = $(container);
      const hasImage = $container.find('img').length > 0;
      const hasHeading = $container.find('h1,h2,h3,h4,h5,h6').length > 0;
      
      if (hasImage && hasHeading) {
        const member = extractTeamMemberInfo($, container);
        if (member) teamMembers.push(member);
      }
    });
  }
  
  return teamMembers;
}

function extractTeamMemberInfo($: CheerioAPI, element: CheerioElement): TeamMember | null {
  const $element = $(element);
  
  // Try multiple selectors for name
  const name = $element.find('h1,h2,h3,h4,h5,h6,.name,[class*="name"]').first().text().trim() ||
               $element.find('img').attr('alt')?.trim() ||
               $element.find('strong,b').first().text().trim();
               
  if (!name) return null;
  
  const member: TeamMember = { name };
  
  // Extract role with multiple attempts
  member.role = $element.find('.role,.position,.title,[class*="role"],[class*="position"],[class*="title"]').first().text().trim() ||
                $element.find('p').first().text().trim();
                
  // Clean up role if it contains the name
  if (member.role?.includes(name)) {
    member.role = member.role.replace(name, '').trim();
  }
  
  // Extract image with multiple attempts
  member.image = $element.find('img').attr('src') ||
                 $element.find('img').attr('data-src') ||
                 $element.find('[style*="background"]').attr('style')?.match(/url\(['"]?(.*?)['"]?\)/)?.[1];
                 
  // Extract description with multiple attempts
  member.description = $element.find('.bio,.description,[class*="bio"],[class*="description"]').text().trim() ||
                      $element.find('p').slice(1).text().trim();
                      
  // Extract contact info
  member.email = $element.find('a[href^="mailto:"]').attr('href')?.replace('mailto:', '');
  member.telephone = $element.find('a[href^="tel:"]').attr('href')?.replace('tel:', '') ||
                    $element.text().match(/\(?[0-9]{3}\)?[-. ]?[0-9]{3}[-. ]?[0-9]{4}/)?.[0];
  
  return member;
}

export async function scrapeUrl(url: string): Promise<ScrapedContent | undefined> {
  try {
    console.log(`\nAttempting to scrape: ${url}`);
    const html = await fetchWithRetry(url);
    if (!html) return undefined;

    const $ = cheerio.load(html);
    console.log('HTML loaded successfully. Page title:', $('title').text());
    console.log('Meta description:', $('meta[name="description"]').attr('content'));
    
    const content: ScrapedContent = {
      url,
      rawText: '',
      people: []
    };

    // Collect all text content
    content.rawText = $('body').text()
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
    
    console.log(`Extracted ${content.rawText.length} characters of raw text`);
    console.log('First 200 chars of content:', content.rawText.substring(0, 200));

    // Find people using various methods
    findPeopleInStructuredContent($, content.people);
    console.log('Checked structured content for people');
    
    findPeopleInUnstructuredContent($, content.people);
    console.log('Checked unstructured content for people');
    
    findPeopleInTeamSection($, content.people);
    console.log('Checked team sections for people');
    
    findPeopleInAboutPage($, content.people);
    console.log('Checked about sections for people');
    
    findPeopleInLeadershipSection($, content.people);
    console.log('Checked leadership sections for people');
    
    // Log all found elements that might contain people
    console.log('\nPotential people-containing elements found:');
    $('.team-member, .staff-member, .employee, .bio, .profile, .person, .member, [class*="team"], [class*="staff"]').each((i, el) => {
      console.log(`${i + 1}. Element:`, $(el).prop('tagName'), 'Classes:', $(el).attr('class'));
      console.log('   Text content:', $(el).text().trim().substring(0, 100) + '...');
    });
    
    // Deduplicate people
    content.people = deduplicatePeople(content.people);
    
    if (content.people.length > 0) {
      console.log('\nFound people:');
      content.people.forEach(person => {
        console.log(`- ${person.name}${person.role ? ` (${person.role})` : ''}`);
        if (person.imageUrl) console.log(`  Image: ${person.imageUrl}`);
        if (person.details) console.log(`  Details: ${person.details.substring(0, 100)}...`);
        if (person.socialLinks) console.log(`  Social:`, person.socialLinks);
      });
    } else {
      console.log('No people found on this page');
      // Log some debug info about the page structure
      console.log('\nPage structure debug:');
      console.log('- Number of divs:', $('div').length);
      console.log('- Number of sections:', $('section').length);
      console.log('- Number of articles:', $('article').length);
      console.log('- Number of images:', $('img').length);
      console.log('- Number of headings:', $('h1,h2,h3,h4,h5,h6').length);
      // Log all headings
      $('h1,h2,h3,h4,h5,h6').each((i, el) => {
        console.log(`Heading ${i + 1}:`, $(el).text().trim());
      });
    }

    return content;
  } catch (error) {
    console.error('Error scraping URL:', error);
    return undefined;
  }
}

function findPeopleInStructuredContent($: CheerioAPI, people: Person[]) {
  // Look for structured team member elements
  const selectors = [
    '.team-member', '.staff-member', '.employee',
    '[class*="team-member"]', '[class*="staff"]', '[class*="employee"]',
    '.bio', '.profile', '.person', '.member',
    '[itemtype*="Person"]', '[class*="profile"]'
  ];

  selectors.forEach(selector => {
    $(selector).each((_, el) => {
      const $el = $(el);
      const person = extractPersonInfo($, el);
      if (person) people.push(person);
    });
  });
}

function findPeopleInUnstructuredContent($: CheerioAPI, people: Person[]) {
  // Look for elements that might contain people info
  $('div, section, article').each((_, el) => {
    const $el = $(el);
    
    // Check if this element likely contains a person
    const hasName = $el.find('h1, h2, h3, h4, h5, h6, .name, [class*="name"]').length > 0;
    const hasImage = $el.find('img').length > 0;
    const hasTitle = $el.find('.title, .role, .position, [class*="title"], [class*="role"]').length > 0;
    
    if ((hasName && hasImage) || (hasName && hasTitle)) {
      const person = extractPersonInfo($, el);
      if (person) people.push(person);
    }
  });
}

function findPeopleInTeamSection($: CheerioAPI, people: Person[]) {
  // Look specifically in team/staff sections
  const teamSections = [
    '#team', '#staff', '#our-team', '#meet-the-team',
    '.team', '.staff', '.our-team', '.meet-the-team',
    '[class*="team-section"]', '[class*="staff-section"]'
  ];

  teamSections.forEach(selector => {
    const $section = $(selector);
    if ($section.length) {
      // Look for people within this section
      $section.find('div, article, li').each((_, el) => {
        const person = extractPersonInfo($, el);
        if (person) people.push(person);
      });
    }
  });
}

function findPeopleInAboutPage($: CheerioAPI, people: Person[]) {
  // Look for people mentioned in about/company sections
  const aboutSections = [
    '#about', '.about', '.about-us', '.company',
    '[class*="about-section"]', '[class*="company-section"]'
  ];

  aboutSections.forEach(selector => {
    const $section = $(selector);
    if ($section.length) {
      $section.find('div, article').each((_, el) => {
        const person = extractPersonInfo($, el);
        if (person) people.push(person);
      });
    }
  });
}

function findPeopleInLeadershipSection($: CheerioAPI, people: Person[]) {
  // Look for leadership/management team
  const leadershipSections = [
    '#leadership', '.leadership', '.executives', '.management',
    '[class*="leadership"]', '[class*="executive"]', '[class*="management"]'
  ];

  leadershipSections.forEach(selector => {
    const $section = $(selector);
    if ($section.length) {
      $section.find('div, article').each((_, el) => {
        const person = extractPersonInfo($, el);
        if (person) people.push(person);
      });
    }
  });
}

function extractPersonInfo($: CheerioAPI, element: CheerioElement): Person | null {
  const $el = $(element);
  
  // Try to find name
  const name = findName($el);
  if (!name) return null;

  const person: Person = { name };

  // Find role/title
  person.role = findRole($el);

  // Find image
  person.imageUrl = findImage($el);

  // Find social links
  person.socialLinks = findSocialLinks($el);

  // Collect additional details/context
  person.details = findDetails($el);

  return person;
}

function findName($el: cheerio.Cheerio<CheerioElement>): string | null {
  return (
    $el.find('h1, h2, h3, h4, h5, h6, .name, [class*="name"]').first().text().trim() ||
    $el.find('img[alt]').attr('alt')?.trim() ||
    $el.find('strong, b').first().text().trim() ||
    null
  );
}

function findRole($el: cheerio.Cheerio<CheerioElement>): string | undefined {
  return (
    $el.find('.title, .role, .position, [class*="title"], [class*="role"], [class*="position"]').first().text().trim() ||
    $el.find('p').first().text().trim() ||
    undefined
  );
}

function findImage($el: cheerio.Cheerio<CheerioElement>): string | undefined {
  return (
    $el.find('img').attr('src') ||
    $el.find('img').attr('data-src') ||
    $el.find('[style*="background"]').attr('style')?.match(/url\(['"]?(.*?)['"]?\)/)?.[1] ||
    undefined
  );
}

function findSocialLinks($el: cheerio.Cheerio<CheerioElement>): Person['socialLinks'] {
  const links: Person['socialLinks'] = {};

  // Find LinkedIn
  const linkedinLink = $el.find('a[href*="linkedin.com"]').attr('href');
  if (linkedinLink) links.linkedin = linkedinLink;

  // Find Twitter
  const twitterLink = $el.find('a[href*="twitter.com"]').attr('href');
  if (twitterLink) links.twitter = twitterLink;

  // Find Instagram
  const instagramLink = $el.find('a[href*="instagram.com"]').attr('href');
  if (instagramLink) links.instagram = instagramLink;

  // Find Email
  const emailLink = $el.find('a[href^="mailto:"]').attr('href');
  if (emailLink) links.email = emailLink.replace('mailto:', '');

  return Object.keys(links).length > 0 ? links : undefined;
}

function findDetails($el: cheerio.Cheerio<CheerioElement>): string | undefined {
  const details = [
    $el.find('.bio, [class*="bio"]').text().trim(),
    $el.find('.description, [class*="description"]').text().trim(),
    $el.find('p').slice(1).text().trim()
  ].filter(Boolean).join('\n');

  return details || undefined;
}

function deduplicatePeople(people: Person[]): Person[] {
  const seen = new Set<string>();
  return people.filter(person => {
    const key = person.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}