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
  ownerName?: string;
  contactEmail?: string;
  phoneNumber?: string;
  linkedin?: string;
  description?: string;
  address?: string;
  website?: string;
  socialMedia?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
  hours?: {
    [key: string]: string;
  };
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

function extractFromHtml(html: string): Partial<ScrapedBusinessData> {
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

    // Business name - check multiple sources with better validation
    const titleMatches = [
      // First check for explicit business name metadata
      html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]+)"/),
      html.match(/<meta[^>]*name="application-name"[^>]*content="([^"]+)"/),
      
      // Then check for known business identifiers
      html.match(/<a[^>]*aria-label="([^"]+?(?:\s+home|\s+homepage)?)"[^>]*>/i),
      html.match(/<img[^>]*alt="([^"]+?(?:\s+logo|\s+home|\s+homepage)?)"[^>]*>/i),
      
      // Then try canonical URL and title
      html.match(/<link[^>]*rel="canonical"[^>]*href="https?:\/\/(?:www\.)?([^/]+)"/),
      html.match(/<title[^>]*>([^<]+)<\/title>/),
      html.match(/<h1[^>]*>([^<]+)<\/h1>/),
      html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/)
    ];
    
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
    
    // Try to match against known companies, including partial domain matches
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
        } else {
          // Otherwise try to extract from matches
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
                  !/menu|navigation|search|logo|home|homepage/i.test(name)) {
                data.businessName = name;
                break;
              }
            }
          }
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
      return !email.includes('example.com') && 
             !email.includes('yourdomain') &&
             !email.includes('domain.com') &&
             !email.includes('email@') &&
             email.length < 100;
    });
    
    if (validEmails.length > 0) {
      data.contactEmail = validEmails[0];
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
        if (digits === '2001000003') return false;
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
      linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9-]+(?:\/[^?#]*)?/,
      twitter: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+(?:\/[^?#]*)?/,
      facebook: /https?:\/\/(?:www\.)?facebook\.com\/(?!sharer|share|login)[a-zA-Z0-9.\-]+(?:\/[^?#]*)?/,
      instagram: /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_]+(?:\/[^?#]*)?/
    };

    for (const [platform, pattern] of Object.entries(socialPatterns)) {
      const matches = html.match(new RegExp(pattern, 'g')) || [];
      const validUrls = matches.filter(url => 
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

export async function scrapeWebsite(url: string, options: { retries?: number } = {}): Promise<ScrapeResult> {
  const maxRetries = options.retries || MAX_RETRIES;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} - Starting scrape of: ${url}`);
      console.log('Initializing Firecrawl with API key:', API_KEY?.slice(0, 4) + '...');

      const response = await firecrawl.scrapeUrl(url, {
        formats: ['markdown', 'html']
      });

      if (!response || !response.success) {
        throw new Error('Firecrawl request failed: ' + JSON.stringify(response));
      }

      // Clean the HTML before extraction
      const cleanedHtml = cleanHtml(response.html || '');
      const extractedData = extractFromHtml(cleanedHtml);

      // Clean and validate extracted data
      if (extractedData.businessName) {
        extractedData.businessName = cleanText(extractedData.businessName);
      }
      
      if (extractedData.description) {
        extractedData.description = cleanText(extractedData.description);
      }

      // Try to extract from markdown if HTML extraction failed
      if (!extractedData.businessName) {
        const h1FromMarkdown = extractFromMarkdown(response.markdown || '', 'h1');
        if (h1FromMarkdown) {
          extractedData.businessName = cleanText(h1FromMarkdown);
        }
      }

      // Clean social media URLs
      if (extractedData.socialMedia) {
        Object.entries(extractedData.socialMedia).forEach(([platform, url]) => {
          if (url && (url.includes('share') || url.includes('sharer') || url.length > 200)) {
            delete extractedData.socialMedia![platform as keyof typeof extractedData.socialMedia];
          }
        });
      }

      // Remove empty objects
      if (extractedData.socialMedia && Object.keys(extractedData.socialMedia).length === 0) {
        delete extractedData.socialMedia;
      }
      
      if (extractedData.hours && Object.keys(extractedData.hours).length === 0) {
        delete extractedData.hours;
      }

      // Validate we have at least some useful data
      if (!extractedData.businessName && !extractedData.phoneNumber && !extractedData.contactEmail) {
        console.warn('Warning: No primary business data was extracted');
      }

      return {
        success: true,
        markdown: response.markdown || '',
        metadata: {
          ...response.metadata,
          url // Include the source URL
        },
        html: cleanedHtml,
        businessData: extractedData
      };

    } catch (error: any) {
      lastError = error;
      console.error(`Attempt ${attempt}/${maxRetries} failed:`, {
        error,
        errorMessage: error?.message || 'Unknown error',
        errorStack: error?.stack || 'No stack trace available'
      });

      if (attempt < maxRetries) {
        const delayTime = RETRY_DELAY * attempt;
        console.log(`Retrying in ${delayTime}ms...`);
        await delay(delayTime);
      }
    }
  }

  return {
    success: false,
    error: {
      code: 'SCRAPE_FAILED',
      message: 'All retry attempts failed',
      details: lastError
    }
  };
} 