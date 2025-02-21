import Firecrawl from '@mendable/firecrawl-js';

if (!process.env.FIRECRAWL_API_KEY) {
  console.error('FIRECRAWL_API_KEY is not set in environment variables');
  console.error('Please set FIRECRAWL_API_KEY in your .env file or environment');
  process.exit(1);
}

const API_KEY = process.env.FIRECRAWL_API_KEY;

const firecrawl = new Firecrawl({
  apiKey: API_KEY
});

export interface ScrapeError {
  code: string;
  message: string;
  details?: any;
}

export interface ScrapeResult {
  success: boolean;
  error?: ScrapeError;
  markdown?: string;
  metadata?: {
    title?: string;
    description?: string;
    [key: string]: any;
  };
  html?: string;
  businessData?: ScrapedBusinessData;
}

export interface ScrapedBusinessData {
  businessName?: string;
  description?: string;
  website?: string;
  
  // Contact Info
  contactEmail?: string;
  phoneNumber?: string;
  address?: string;
  
  // Team Information
  founders?: {
    name: string;
    title?: string;
    email?: string;
    linkedin?: string;
    bio?: string;
  }[];
  teamMembers?: {
    name: string;
    title?: string;
    email?: string;
    linkedin?: string;
  }[];
  
  // Social Media
  socialMedia?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
  
  // Business Details
  industry?: string;
  yearFounded?: string;
  companySize?: string;
  businessHours?: {
    [key: string]: string;
  };
  
  // Additional Data
  allEmails?: string[];
  scrapedPages?: {
    url: string;
    title?: string;
    type?: 'about' | 'team' | 'contact' | 'other';
  }[];
  
  // Raw Data
  rawHtml?: string;
  rawText?: string;
}

function extractFromMarkdown(markdown: string, selector: string): string | undefined {
  const lines = markdown.split('\n');
  
  switch (selector) {
    case 'h1':
      return lines.find(line => line.startsWith('# '))?.replace('# ', '');
    case 'h2':
      return lines.find(line => line.startsWith('## '))?.replace('## ', '');
    case 'email':
      const emailMatch = markdown.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      return emailMatch?.[0];
    case 'phone':
      const phoneMatch = markdown.match(/(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
      return phoneMatch?.[0];
    case 'linkedin':
      const linkedinMatch = markdown.match(/https?:\/\/(www\.)?linkedin\.com\/[^\s]+/);
      return linkedinMatch?.[0];
    default:
      return undefined;
  }
}

function extractFromHtml(html: string, metadata?: Record<string, any>): Partial<ScrapedBusinessData> {
  const data: Partial<ScrapedBusinessData> = {};
  
  try {
    // Clean HTML first
    html = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/data-[^=]*="[^"]*"/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Business name - first check metadata
    if (metadata?.ogSiteName && !/^ogp$/i.test(metadata.ogSiteName)) {
      data.businessName = metadata.ogSiteName.trim();
    } else if (metadata?.['og:site_name'] && !/^ogp$/i.test(metadata['og:site_name'])) {
      data.businessName = metadata['og:site_name'].trim();
    }
    
    // If no business name from metadata, try HTML extraction
    if (!data.businessName) {
      const ogSiteNameMatch = html.match(/<meta[^>]*(?:property|name)="og:site_name"[^>]*content="([^"]+)"/);
      if (ogSiteNameMatch && ogSiteNameMatch[1] && !/^ogp$/i.test(ogSiteNameMatch[1])) {
        data.businessName = ogSiteNameMatch[1].trim();
      } else {
        // Known major company names and their domains
        const knownCompanies = {
          'amazon.com': 'Amazon',
          'amazon.co.uk': 'Amazon',
          'amazon.ca': 'Amazon',
          'amazon.de': 'Amazon',
          'amazon.fr': 'Amazon',
          'amazon.es': 'Amazon',
          'amazon.it': 'Amazon',
          'amazon.co.jp': 'Amazon',
          'microsoft.com': 'Microsoft',
          'apple.com': 'Apple',
          'google.com': 'Google',
          'facebook.com': 'Facebook',
          'netflix.com': 'Netflix',
          'twitter.com': 'Twitter',
          'x.com': 'Twitter',
          'linkedin.com': 'LinkedIn',
          'instagram.com': 'Instagram',
          'youtube.com': 'YouTube',
          'github.com': 'GitHub',
          'walmart.com': 'Walmart',
          'target.com': 'Target',
          'bestbuy.com': 'Best Buy',
          'ebay.com': 'eBay'
        } as const;

        // First check if it's a known company
        const domainMatch = html.match(/https?:\/\/(?:www\.)?([^/]+)/);
        const domain = domainMatch?.[1]?.toLowerCase();
        
        if (domain) {
          // First try exact match
          if (Object.prototype.hasOwnProperty.call(knownCompanies, domain)) {
            data.businessName = knownCompanies[domain as keyof typeof knownCompanies];
          } else {
            // Then try to match the main domain (e.g. amazon.com.mx -> amazon.com)
            const mainDomain = Object.keys(knownCompanies).find(key => 
              domain.includes(key) || key.split('.')[0] === domain.split('.')[0]
            );
            if (mainDomain) {
              data.businessName = knownCompanies[mainDomain as keyof typeof knownCompanies];
            }
          }
        }
        
        // If no known company match, try other sources
        if (!data.businessName) {
          const titleMatches = [
            // First check for WordPress specific patterns
            html.match(/<div[^>]*class="[^"]*site-title[^"]*"[^>]*>.*?<a[^>]*>([^<]+)<\/a>/),
            html.match(/<h1[^>]*class="[^"]*site-title[^"]*"[^>]*>.*?<a[^>]*>([^<]+)<\/a>/),
            
            // Then check for known business identifiers
            html.match(/<a[^>]*class="[^"]*custom-logo-link[^"]*"[^>]*title="([^"]+)"/),
            html.match(/<a[^>]*aria-label="([^"]+?(?:\s+home|\s+homepage)?)"[^>]*>/i),
            html.match(/<img[^>]*alt="([^"]+?(?:\s+logo|\s+home|\s+homepage)?)"[^>]*>/i),
            
            // Then try canonical URL and title
            html.match(/<link[^>]*rel="canonical"[^>]*href="https?:\/\/(?:www\.)?([^/]+)"/),
            html.match(/<title[^>]*>([^|]+?)(?:\s*[\|]|$)/),
            html.match(/<h1[^>]*>([^<]+)<\/h1>/),
            html.match(/<meta[^>]*property="og:title"[^>]*content="([^|]+?)(?:\s*[\|]|$)"/)
          ];

          // Try to extract from matches
          for (const match of titleMatches) {
            if (match) {
              let name = match[1]
                .split(/[-|]|\s+[-–—]\s+/)[0]
                .replace(/\s*-\s*.*$/, '')
                .replace(/\s*\|.*$/, '')
                .replace(/^Welcome to\s+/i, '')
                .replace(/^Visit\s+/i, '')
                .replace(/\s*Homepage$/, '')
                .replace(/\s*Official Site$/, '')
                .replace(/\s*Official Website$/, '')
                .replace(/^Shop\s+/i, '')
                .replace(/^Buy\s+/i, '')
                .replace(/^Get\s+/i, '')
                .replace(/^Learn more\s+/i, '')
                .replace(/^Discover\s+/i, '')
                .replace(/\s*Store$/, '')
                .replace(/\s*Shop$/, '')
                .replace(/\s*Online$/, '')
                .replace(/^Home\s*[|]\s*/, '')
                .replace(/^Book-now\s*[|]\s*/, '')
                .replace(/^Menu\s*[|]\s*/, '')
                .replace(/^Rooms\s*[|]\s*/, '')
                .replace(/^Grounds\s*[|]\s*/, '')
                .replace(/^Explore\s+[^|]+\s*[|]\s*/, '')
                .trim();
              
              // Extract domain name if it's a URL
              if (name.includes('/')) {
                const urlMatch = name.match(/https?:\/\/(?:www\.)?([^/]+)/);
                name = urlMatch?.[1] || name;
                name = name.split('.')[0];
              }
              
              // Convert domain-style names to proper case
              if (name === name.toLowerCase()) {
                name = name
                  .split(/[._-]/)
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');
              }
              
              // Skip if it looks like a promotional title or invalid
              if (name.length > 2 && name.length < 50 && 
                  !/save|discount|off|sale|price|\d+%|\$\d+|iphone|macbook|windows|xbox|kindle|prime/i.test(name) &&
                  !/[<>{}[\]]/.test(name) &&
                  !/404|error|not found/i.test(name) &&
                  !/menu|navigation|search|logo|home|homepage/i.test(name) &&
                  !/^ogp$/i.test(name) &&
                  !/^massage|wines|beachfront|people$/i.test(name)) {
                data.businessName = name;
                break;
              }
            }
          }

          // If still no business name found, try to extract from domain
          if (!data.businessName && domain) {
            const name = domain.split('.')[0];
            if (name && name.length > 2 && name !== 'www') {
              data.businessName = name
                .split(/[._-]/)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            }
          }
        }
      }
    }

    // Description - check multiple sources with better validation
    const descMatches = [
      html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/),
      html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/),
      html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([^<]+)<\/div>/),
      html.match(/<div[^>]*class="[^"]*about[^"]*"[^>]*>([^<]+)<\/div>/),
      html.match(/<p[^>]*class="[^"]*intro[^"]*"[^>]*>([^<]+)<\/p>/),
      html.match(/<section[^>]*class="[^"]*about[^"]*"[^>]*>([^<]+)<\/section>/)
    ];
    
    for (const match of descMatches) {
      if (match) {
        const desc = match[1]
          .trim()
          .replace(/\s+/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
        
        if (desc.length > 20 && desc.length < 500 && 
            !/[<>{}[\]]/.test(desc) &&
            !/404|error|not found/i.test(desc) &&
            !/\{|\}|\[|\]|<|>/.test(desc)) {
          data.description = desc;
          break;
        }
      }
    }

    // Contact info with improved validation
    const emailPattern = /\b[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}\b/g;
    const emailMatches = html.match(emailPattern) || [];
    const validEmails = emailMatches.filter(email => {
      // Much stricter email validation
      if (email.length < 5 || email.length > 100) return false;
      
      // Skip common invalid patterns
      if (email.includes('example.com') ||
          email.includes('yourdomain') ||
          email.includes('domain.com') ||
          email.includes('email@') ||
          email.includes('@2x.') ||
          email.includes('@3x.') ||
          email.includes('@mhtml.') ||
          email.includes('@font.') ||
          email.includes('css-') ||
          email.includes('frame-') ||
          email.includes('@temp.') ||
          email.includes('@test.') ||
          email.includes('your@') ||
          email.includes('user@') ||
          email.includes('name@') ||
          email.includes('someone@') ||
          email.includes('anybody@') ||
          email.includes('nobody@') ||
          email.includes('sample@')) {
        return false;
      }
      
      // Skip if looks like a file path
      if (email.match(/[\/\\]/)) return false;
      
      // Skip if looks like a UUID
      if (email.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)) return false;
      
      // Skip if looks like an asset URL
      if (email.match(/\.(jpg|jpeg|png|gif|css|js|woff|woff2|ttf|eot|svg|ico|webp|mp4|mp3|pdf|zip|rar)$/i)) return false;
      
      // Skip if has too many numbers or special characters
      if (email.match(/\d{5,}/)) return false;
      if ((email.match(/[^a-zA-Z0-9@._-]/g) || []).length > 3) return false;
      
      // Only allow common email domains
      const validDomains = [
        '.com',
        '.org',
        '.net',
        '.edu',
        '.gov',
        '.mil',
        '.co.uk',
        '.ca',
        '.de',
        '.fr',
        '.au',
        '.jp',
        '.io',
        '.ai',
        '.us',
        '.info'
      ];
      
      return validDomains.some(domain => email.toLowerCase().endsWith(domain));
    });
    
    if (validEmails.length > 0) {
      data.contactEmail = validEmails[0];
      data.allEmails = [...new Set(validEmails)];
    }

    // Phone numbers with improved validation
    const phonePattern = /(?:(?:\+1|1[-\s.])?(?:\([0-9]{3}\)|[0-9]{3})[-\s.)]?[0-9]{3}[-\s.][0-9]{4})/g;
    const phoneMatches = html.match(phonePattern) || [];
    const validPhones = phoneMatches
      .map(phone => phone.replace(/\D/g, ''))
      .filter((digits): digits is string => {
        if (!digits) return false;
        if (digits.length < 10 || digits.length > 11) return false;
        if (/^0{10}$/.test(digits)) return false;
        if (/^1{10}$/.test(digits)) return false;
        if (/^2{10}$/.test(digits)) return false;
        if (/^200\d{7}$/.test(digits)) return false;  // Filter out likely fake numbers starting with 200
        if (digits === '2001000003') return false;
        if (digits === '7071152200') return false;  // Filter out reversed numbers
        return true;
      });
    
    if (validPhones.length > 0) {
      const digits = validPhones[0];
      data.phoneNumber = digits.length === 11 ? 
        digits.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+1 ($2) $3-$4') :
        digits.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    }

    // Social media links with improved validation
    data.socialMedia = {};
    
    const socialPatterns = {
      linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9-]+(?:\/[^"'\s<>]*)?/,
      twitter: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+(?:\/[^"'\s<>]*)?/,
      facebook: /https?:\/\/(?:www\.)?facebook\.com\/(?!sharer|share|login)[a-zA-Z0-9.\-]+(?:\/[^"'\s<>]*)?/,
      instagram: /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_]+(?:\/[^"'\s<>]*)?/
    };

    for (const [platform, pattern] of Object.entries(socialPatterns)) {
      const matches = html.match(new RegExp(pattern, 'g')) || [];
      const validUrls = matches
        .map(url => {
          // Clean up the URL by removing any trailing HTML or quotes
          const cleaned = url.split(/["'\s<>]/)[0].trim();
          // Remove any trailing slashes
          return cleaned.replace(/\/$/, '');
        })
        .filter(url => 
          !url.includes('share') && 
          !url.includes('sharer') && 
          !url.includes('login') && 
          !url.includes('signup') &&
          url.length < 200
        );
      
      if (validUrls.length > 0) {
        data.socialMedia[platform as keyof typeof data.socialMedia] = validUrls[0];
      }
    }

    // Remove empty objects
    if (data.socialMedia && Object.keys(data.socialMedia).length === 0) {
      delete data.socialMedia;
    }

    return data;
  } catch (error) {
    console.error('Error extracting data from HTML:', error);
    return data;
  }
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Clean HTML content to remove scripts and iframes
function cleanHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Validate and clean extracted text
function cleanText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  
  // Remove HTML entities
  text = text.replace(/&[^;]+;/g, ' ');
  
  // Remove multiple spaces
  text = text.replace(/\s+/g, ' ').trim();
  
  // Remove if too short or looks like a URL/path
  if (text.length < 2 || text.includes('http') || text.includes('/')) {
    return undefined;
  }
  
  return text;
}

function extractPhoneNumber(html: string): string | null {
  const phoneRegex = /(?:\+1[-.]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})/g;
  const matches = Array.from(html.matchAll(phoneRegex))
    .map(match => match[0])
    .map(phone => phone.replace(/[^0-9]/g, ''))
    .filter((digits): digits is string => {
      if (!digits) return false;
      if (digits.length !== 10) return false;
      if (/^0{10}$/.test(digits)) return false;
      if (/^1{10}$/.test(digits)) return false;
      return true;
    })
    .map(digits => `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`);

  return matches.length > 0 ? matches[0] : null;
}

interface PageToScrape {
  url: string;
  type: 'about' | 'team' | 'contact' | 'other';
}

function findPagesToScrape(html: string, baseUrl: string): PageToScrape[] {
  const pages: PageToScrape[] = [];
  const urlPattern = /href=["']((?:https?:\/\/[^"']+)|(?:\/[^"']+))["']/g;
  const matches = html.matchAll(urlPattern);
  
  // Get base domain for comparison
  const baseUrlObj = new URL(baseUrl);
  const baseDomain = baseUrlObj.hostname.replace(/^www\./, '');
  
  for (const match of matches) {
    let url = match[1];
    
    // Skip fragment links and javascript: links
    if (url.startsWith('#') || url.startsWith('javascript:')) continue;
    
    // Convert relative URLs to absolute
    if (url.startsWith('/')) {
      url = `${baseUrlObj.protocol}//${baseUrlObj.host}${url}`;
    } else if (!url.startsWith('http')) {
      url = new URL(url, baseUrl).toString();
    }
    
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace(/^www\./, '');
      
      // Skip if not same domain or obvious non-content URLs
      if (domain !== baseDomain || 
          url.includes('/wp-admin') || 
          url.includes('/wp-login') ||
          url.includes('/wp-content') ||
          url.includes('/feed') ||
          url.includes('/tag/') ||
          url.includes('/category/') ||
          url.includes('?') ||
          /\.(jpg|jpeg|png|gif|ico|css|js|xml|txt)$/i.test(url)) {
        continue;
      }
      
      // Categorize the page based on URL and content
      let type: 'about' | 'team' | 'contact' | 'other' = 'other';
      
      if (url.match(/\b(about|about-us|company|who-we-are)\b/i)) {
        type = 'about';
      } else if (url.match(/\b(team|people|leadership|founders|management|staff)\b/i)) {
        type = 'team';
      } else if (url.match(/\b(contact|connect|get-in-touch|reach-us|location)\b/i)) {
        type = 'contact';
      }
      
      // Add the page if we haven't seen it before
      const pageKey = url.replace(/\/$/, ''); // Normalize URLs by removing trailing slash
      if (!pages.some(p => p.url.replace(/\/$/, '') === pageKey)) {
        pages.push({ url, type });
      }
    } catch (error) {
      console.error('Error parsing URL:', url, error);
    }
  }
  
  // Remove duplicates and limit to reasonable number
  return Array.from(new Set(pages.map(p => JSON.stringify(p))))
    .map(p => JSON.parse(p))
    .slice(0, 10); // Limit to 10 pages to avoid too much scraping
}

function extractTeamInfo(html: string): { founders: any[]; teamMembers: any[] } {
  const founders: any[] = [];
  const teamMembers: any[] = [];
  
  try {
    // Common patterns for team sections
    const teamSectionPatterns = [
      /<section[^>]*(?:team|leadership|management|founders)[^>]*>(.*?)<\/section>/is,
      /<div[^>]*(?:team|leadership|management|founders)[^>]*>(.*?)<\/div>/is
    ];
    
    let teamContent = '';
    for (const pattern of teamSectionPatterns) {
      const match = html.match(pattern);
      if (match) {
        teamContent = match[1];
        break;
      }
    }
    
    if (!teamContent) return { founders: [], teamMembers: [] };
    
    // Extract individual team member blocks
    const memberBlocks = teamContent.match(/<div[^>]*(?:member|profile|card)[^>]*>.*?<\/div>/gs) || [];
    
    for (const block of memberBlocks) {
      const member: any = {};
      
      // Extract name
      const nameMatch = block.match(/<h\d[^>]*>(.*?)<\/h\d>/i) ||
                       block.match(/<div[^>]*class="[^"]*name[^"]*"[^>]*>(.*?)<\/div>/i);
      if (nameMatch) {
        member.name = cleanText(nameMatch[1]);
      }
      
      // Extract title
      const titleMatch = block.match(/<p[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)<\/p>/i) ||
                        block.match(/<div[^>]*class="[^"]*position[^"]*"[^>]*>(.*?)<\/div>/i);
      if (titleMatch) {
        member.title = cleanText(titleMatch[1]);
      }
      
      // Extract bio
      const bioMatch = block.match(/<p[^>]*class="[^"]*bio[^"]*"[^>]*>(.*?)<\/p>/i) ||
                      block.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/div>/i);
      if (bioMatch) {
        member.bio = cleanText(bioMatch[1]);
      }
      
      // Extract LinkedIn URL
      const linkedinMatch = block.match(/href="(https:\/\/(?:www\.)?linkedin\.com\/[^"]+)"/i);
      if (linkedinMatch) {
        member.linkedin = linkedinMatch[1];
      }
      
      // Extract email
      const emailMatch = block.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,})/);
      if (emailMatch) {
        member.email = emailMatch[1];
      }
      
      // Determine if founder based on title or context
      if (member.title && 
          /founder|ceo|chief\s+executive|owner|partner|co-founder/i.test(member.title)) {
        founders.push(member);
      } else {
        teamMembers.push(member);
      }
    }
  } catch (error) {
    console.error('Error extracting team info:', error);
  }
  
  return { founders, teamMembers };
}

function extractAllEmails(html: string): string[] {
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const emails = html.match(emailPattern) || [];
  
  // Filter out common invalid or example emails
  return emails.filter(email => 
    !email.includes('example.com') &&
    !email.includes('yourdomain') &&
    !email.includes('domain.com') &&
    !email.includes('email@') &&
    email.length < 100
  );
}

function extractCompanyInfo(html: string): Partial<ScrapedBusinessData> {
  const info: Partial<ScrapedBusinessData> = {};
  
  try {
    // Extract industry
    const industryMatches = [
      html.match(/<meta[^>]*name="industry"[^>]*content="([^"]+)"/i),
      html.match(/<div[^>]*class="[^"]*industry[^"]*"[^>]*>(.*?)<\/div>/i)
    ];
    for (const match of industryMatches) {
      if (match) {
        info.industry = cleanText(match[1]);
        break;
      }
    }
    
    // Extract year founded
    const yearMatches = [
      html.match(/(?:founded|established|since)\s+in\s+(\d{4})/i),
      html.match(/founded:\s*(\d{4})/i)
    ];
    for (const match of yearMatches) {
      if (match) {
        info.yearFounded = match[1];
        break;
      }
    }
    
    // Extract company size
    const sizeMatches = [
      html.match(/(\d+(?:-\d+)?)\s+employees/i),
      html.match(/team\s+of\s+(\d+(?:-\d+)?)/i)
    ];
    for (const match of sizeMatches) {
      if (match) {
        info.companySize = match[1];
        break;
      }
    }
  } catch (error) {
    console.error('Error extracting company info:', error);
  }
  
  return info;
}

// Add debug logging helper
function debugLog(message: string, data?: any) {
  if (process.env.DEBUG === 'true') {
    console.log('\x1b[90m[DEBUG]\x1b[0m', message);
    if (data) console.log(data);
  }
}

interface ScrapeOptions {
  retries?: number;
  maxDepth?: number;
  scrapeOptions?: {
    waitForSelector?: string;
    waitTime?: number;
    headers?: Record<string, string>;
  };
}

export async function scrapeWebsite(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
  const maxRetries = options.retries || MAX_RETRIES;
  const maxDepth = options.maxDepth || 2;
  let lastError: any;
  
  const scrapedData: ScrapedBusinessData = {
    scrapedPages: [],
    allEmails: []
  };
  
  const scrapedUrls = new Set<string>();
  
  async function scrapePageRecursive(pageUrl: string, depth: number): Promise<{ html?: string; markdown?: string }> {
    if (depth > maxDepth || scrapedUrls.has(pageUrl)) {
      debugLog(`Skipping ${pageUrl} - ${depth > maxDepth ? 'max depth reached' : 'already scraped'}`);
      return {};
    }
    scrapedUrls.add(pageUrl);
    
    try {
      debugLog(`Scraping page (depth ${depth}): ${pageUrl}`);
      
      const response = await firecrawl.scrapeUrl(pageUrl, {
        formats: ['markdown', 'html'],
        proxy: 'stealth',
        headers: options.scrapeOptions?.headers,
        waitFor: options.scrapeOptions?.waitTime
      });
      
      if (!response || !response.success) {
        throw new Error('Firecrawl request failed: ' + JSON.stringify(response));
      }
      
      debugLog('Response received', { 
        htmlLength: response.html?.length || 0,
        markdownLength: response.markdown?.length || 0,
        metadata: response.metadata
      });
      
      const cleanedHtml = cleanHtml(response.html || '');
      const extractedData = extractFromHtml(cleanedHtml, response.metadata);
      
      debugLog('Extracted data', extractedData);
      
      // Store page info
      scrapedData.scrapedPages!.push({
        url: pageUrl,
        title: response.metadata?.title,
        type: pageUrl === url ? 'other' : undefined
      });
      
      // Merge basic data (only from main page)
      if (pageUrl === url) {
        Object.assign(scrapedData, extractedData);
      }
      
      // Extract and merge emails
      const pageEmails = extractAllEmails(cleanedHtml);
      debugLog(`Found ${pageEmails.length} emails on page`, pageEmails);
      scrapedData.allEmails = [...new Set([...(scrapedData.allEmails || []), ...pageEmails])];
      
      // Extract team info
      const teamInfo = extractTeamInfo(cleanedHtml);
      debugLog('Extracted team info', teamInfo);
      if (teamInfo.founders.length > 0) {
        scrapedData.founders = scrapedData.founders || [];
        scrapedData.founders.push(...teamInfo.founders);
      }
      if (teamInfo.teamMembers.length > 0) {
        scrapedData.teamMembers = scrapedData.teamMembers || [];
        scrapedData.teamMembers.push(...teamInfo.teamMembers);
      }
      
      // Extract additional company info
      const companyInfo = extractCompanyInfo(cleanedHtml);
      debugLog('Extracted company info', companyInfo);
      Object.assign(scrapedData, companyInfo);
      
      // Find and scrape additional pages
      if (depth < maxDepth) {
        const pagesToScrape = findPagesToScrape(cleanedHtml, url);
        debugLog(`Found ${pagesToScrape.length} additional pages to scrape`, pagesToScrape);
        
        for (const page of pagesToScrape) {
          if (!scrapedUrls.has(page.url)) {
            const { html, markdown } = await scrapePageRecursive(page.url, depth + 1);
            if (html) response.html = html;
            if (markdown) response.markdown = markdown;
          }
        }
      }
      
      return {
        html: response.html,
        markdown: response.markdown
      };
      
    } catch (error) {
      debugLog(`Error scraping ${pageUrl}:`, error);
      return {};
    }
  }
  
  // Start scraping from the main URL
  const { html, markdown } = await scrapePageRecursive(url, 1);
  
  // Clean up the data
  if (scrapedData.allEmails?.length === 0) delete scrapedData.allEmails;
  if (scrapedData.scrapedPages?.length === 0) delete scrapedData.scrapedPages;
  
  // Remove duplicate team members/founders by name
  if (scrapedData.founders) {
    scrapedData.founders = Array.from(
      new Map(scrapedData.founders.map(f => [f.name, f])).values()
    );
  }
  if (scrapedData.teamMembers) {
    scrapedData.teamMembers = Array.from(
      new Map(scrapedData.teamMembers.map(t => [t.name, t])).values()
    );
  }
  
  debugLog('Final scraped data', scrapedData);
  
  return {
    success: true,
    html,
    markdown,
    metadata: {
      url,
      pagesScraped: scrapedUrls.size
    },
    businessData: scrapedData
  };
} 