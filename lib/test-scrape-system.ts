import 'dotenv/config';
import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { delay } from './utils';

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

const API_KEY = process.env.SCRAPING_BEE_API_KEY!;

export interface BusinessInfo {
  name?: string;
  title?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  hours?: string[];
  services?: string[];
  socialLinks?: Record<string, string>;
  specialties?: string[];
  insurances?: string[];
  procedures?: string[];
  education?: string[];
  affiliations?: string[];
  emergencyInfo?: string;
}

function cleanText(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/"|'/g, '')
    .replace(/\u200B/g, '') // Zero-width space
    .replace(/\u00A0/g, ' ') // Non-breaking space
    .replace(/&#39;/g, "'") // HTML entity for single quote
    .replace(/&amp;/g, '&') // HTML entity for ampersand
    .replace(/&quot;/g, '"') // HTML entity for double quote
    .replace(/&lt;/g, '<') // HTML entity for less than
    .replace(/&gt;/g, '>') // HTML entity for greater than
    .trim();
}

export function extractBusinessInfo(html: string): BusinessInfo {
  const info: BusinessInfo = {};

  try {
    // Clean HTML first
    html = html.replace(/<!--[\s\S]*?-->/g, ''); // Remove comments
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ''); // Remove styles
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ''); // Remove scripts

    // Extract title and practice name
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      info.title = cleanText(titleMatch[1]);
      // Try to extract practice name from title
      const practiceName = titleMatch[1].split(/[-|]|\s+[-–—]\s+/)[0];
      if (practiceName) {
        info.name = cleanText(practiceName);
      }
    }

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    if (descMatch) {
      info.description = cleanText(descMatch[1]);
    }

    // Extract phone numbers with better validation
    const phonePattern = /(?:Phone|Tel|Call|Office|Telephone)?\s*:?\s*(?:\+\d{1,2}\s?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phoneMatches = html.match(phonePattern);
    if (phoneMatches) {
      // Filter out likely invalid numbers
      const validPhones = phoneMatches
        .map(phone => phone.replace(/(?:Phone|Tel|Call|Office|Telephone)?\s*:?\s*/, '').trim())
        .filter(phone => {
          const digits = phone.replace(/\D/g, '');
          return digits.length === 10 && !digits.match(/^(0{10}|1{10}|2{10}|3{10}|4{10}|5{10}|6{10}|7{10}|8{10}|9{10})$/);
        });
      if (validPhones.length > 0) {
        info.phone = validPhones[0];
      }
    }

    // Extract email addresses
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const emailMatches = html.match(emailPattern);
    if (emailMatches) {
      // Filter out common false positives
      const validEmails = emailMatches.filter(email => 
        !email.includes('example.com') &&
        !email.includes('domain.com') &&
        !email.includes('yourdomain') &&
        !email.includes('email@') &&
        !email.includes('user@') &&
        !email.includes('wordpress') &&
        !email.includes('wix.com') &&
        !email.includes('squarespace.com') &&
        !email.includes('template')
      );
      if (validEmails.length > 0) {
        info.email = validEmails[0].toLowerCase();
      }
    }

    // Extract full address with better pattern
    const addressPattern = /\d+[^,\n<>]{0,50}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir|Way|Plaza|Plz|Square|Sq|Suite|Ste|Unit|#)[^,\n<>]{0,50},?\s*(?:[^,\n<>]{1,50},\s*)?(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)[^,\n<>]{0,50}\d{5}(?:-\d{4})?/gi;
    const addressMatch = html.match(addressPattern);
    if (addressMatch) {
      const fullAddress = cleanText(addressMatch[0]);
      info.address = fullAddress;

      // Try to parse city, state, zip
      const parts = fullAddress.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        info.city = parts[1];
        const stateZip = parts[2]?.match(/([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/);
        if (stateZip) {
          info.state = stateZip[1];
          info.zip = stateZip[2];
        }
      }
    }

    // Extract business hours with better pattern
    const hoursPattern = /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^\n<>]{0,50}(?:\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)|closed|Closed|CLOSED|by appointment|By Appointment)/gi;
    const hoursMatches = html.match(hoursPattern);
    if (hoursMatches) {
      info.hours = hoursMatches.map(hour => cleanText(hour));
    }

    // Extract dental services with improved patterns
    const dentalServices = [
      'Cleanings?',
      'Exams?',
      'X-rays?',
      'Fillings?',
      'Crowns?',
      'Bridges?',
      'Implants?',
      'Veneers?',
      'Whitening',
      'Root Canals?',
      'Extractions?',
      'Dentures?',
      'Orthodontics?',
      'Invisalign',
      'Braces',
      'Periodontal',
      'Gum Disease',
      'TMJ',
      'Sleep Apnea',
      'Sedation',
      'Emergency',
      'Preventive',
      'Restorative',
      'Cosmetic',
      'Family',
      'General',
      'Pediatric',
      'Oral Surgery',
      'Dental Hygiene',
      'Check-ups?',
      'Consultations?',
      'Screenings?'
    ].join('|');

    // Look for services in different HTML structures
    const servicePatterns = [
      new RegExp(`(?:<li[^>]*>|<p[^>]*>|<h\\d[^>]*>|<div[^>]*class="[^"]*service[^"]*"[^>]*>)[^<]*(?:${dentalServices})[^<]*(?:</li>|</p>|</h\\d>|</div>)`, 'gi'),
      new RegExp(`(?:offer|provide|specialize)[^<>]{0,50}(?:${dentalServices})[^<>]{0,100}(?:\\.|<)`, 'gi'),
      new RegExp(`(?:${dentalServices})[^<>]{0,100}(?:treatment|procedure|service)s?[^<>]{0,100}(?:\\.|<)`, 'gi')
    ];

    info.services = [];
    for (const pattern of servicePatterns) {
      const matches = html.match(pattern);
      if (matches) {
        info.services.push(...matches
          .map(service => cleanText(service.replace(/<[^>]+>/g, '')))
          .filter(service => service.length > 0)
        );
      }
    }

    // Extract dental procedures
    const proceduresPattern = new RegExp(`(?:procedure|treatment)s?[^<>]*?(?:${dentalServices})[^<>]*?(?:\\.|<)`, 'gi');
    const procedureMatches = html.match(proceduresPattern);
    if (procedureMatches) {
      info.procedures = procedureMatches
        .map(proc => cleanText(proc.replace(/(?:procedures?|treatments?)\s*:?\s*/i, '')))
        .filter(proc => proc.length > 0);
    }

    // Extract specialties
    const specialtiesPattern = /(?:specialist|specializing|expertise|specialized|specialties?)\s+in\s+([^.<>]+)/gi;
    const specialtyMatches = html.match(specialtiesPattern);
    if (specialtyMatches) {
      info.specialties = specialtyMatches
        .map(specialty => cleanText(specialty.replace(/(?:specialist|specializing|expertise|specialized|specialties?)\s+in\s+/i, '')))
        .filter(specialty => specialty.length > 0);
    }

    // Extract accepted insurances
    const insurancePatterns = [
      /(?:accept|take|work with)[^<>]*(?:insurance|PPO|HMO|plans?)[^<>]*?(?:<|\.)/gi,
      /(?:insurance|PPO|HMO)[^<>]*(?:accepted|welcome|provider)[^<>]*?(?:<|\.)/gi,
      /(?:in-network|out-of-network)[^<>]*(?:provider|benefits)[^<>]*?(?:<|\.)/gi
    ];

    info.insurances = [];
    for (const pattern of insurancePatterns) {
      const matches = html.match(pattern);
      if (matches) {
        info.insurances.push(...matches
          .map(ins => cleanText(ins))
          .filter(ins => ins.length > 0)
        );
      }
    }

    // Extract education and affiliations
    const educationPattern = /(?:graduate|graduated|degree|education)[^<>]*?(?:from|of)[^<>]*?(?:University|College|School)[^<>]*?(?:\.|<)/gi;
    const educationMatches = html.match(educationPattern);
    if (educationMatches) {
      info.education = educationMatches
        .map(edu => cleanText(edu))
        .filter(edu => edu.length > 0);
    }

    const affiliationPattern = /(?:member|fellow|affiliated)[^<>]*?(?:of|with)[^<>]*?(?:Association|Society|Academy|Board)[^<>]*?(?:\.|<)/gi;
    const affiliationMatches = html.match(affiliationPattern);
    if (affiliationMatches) {
      info.affiliations = affiliationMatches
        .map(aff => cleanText(aff))
        .filter(aff => aff.length > 0);
    }

    // Extract emergency information
    const emergencyPattern = /(?:emergency|after-hours|urgent)[^<>]*?(?:care|service|dental|treatment|available)[^<>]*?(?:\.|<)/gi;
    const emergencyMatches = html.match(emergencyPattern);
    if (emergencyMatches) {
      info.emergencyInfo = emergencyMatches
        .map(emg => cleanText(emg))
        .join(' ');
    }

    // Extract social media links with improved patterns
    info.socialLinks = {};
    const socialPlatforms = {
      facebook: /https?:\/\/(?:www\.)?(?:facebook\.com|fb\.me)\/[^"'\s<>]+/i,
      twitter: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^"'\s<>]+/i,
      instagram: /https?:\/\/(?:www\.)?instagram\.com\/[^"'\s<>]+/i,
      linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^"'\s<>]+/i,
      yelp: /https?:\/\/(?:www\.)?yelp\.com\/biz\/[^"'\s<>]+/i,
      healthgrades: /https?:\/\/(?:www\.)?healthgrades\.com\/[^"'\s<>]+/i,
      ratemd: /https?:\/\/(?:www\.)?ratemds\.com\/[^"'\s<>]+/i,
      google: /https?:\/\/(?:www\.)?google\.com\/maps\/place\/[^"'\s<>]+/i,
      youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:user|channel)\/[^"'\s<>]+/i
    };

    for (const [platform, pattern] of Object.entries(socialPlatforms)) {
      const match = html.match(pattern);
      if (match) {
        info.socialLinks[platform] = match[0];
      }
    }

  } catch (error) {
    console.error('Error extracting business info:', error);
  }

  return info;
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
        
        // Don't retry on these status codes
        if (status === 404 || status === 403 || status === 401) {
          throw new Error(`Request failed with status code ${status}`);
        }
        
        // Add delay between retries
        if (attempt < maxRetries) {
          const delayMs = attempt * 2000; // Exponential backoff
          console.log(`Attempt ${attempt} failed. Retrying in ${delayMs/1000} seconds...`);
          await delay(delayMs);
        }
      }
    }
  }
  
  throw lastError || new Error('Failed to fetch URL after multiple attempts');
}

export async function scrapeUrl(url: string): Promise<BusinessInfo> {
  try {
    console.log(`Scraping URL: ${url}`);
    const html = await fetchWithRetry(url);
    return extractBusinessInfo(html);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`Error scraping ${url}:`, errorMessage);
    throw error;
  }
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
    let combinedInfo: BusinessInfo = {};
    
    // Try each page
    for (const pageUrl of pagesToCheck) {
      const pageInfo = await scrapeUrl(pageUrl);
      
      // Merge information
      combinedInfo = {
        name: combinedInfo.name || pageInfo.name,
        title: combinedInfo.title || pageInfo.title,
        description: combinedInfo.description || pageInfo.description,
        address: combinedInfo.address || pageInfo.address,
        city: combinedInfo.city || pageInfo.city,
        state: combinedInfo.state || pageInfo.state,
        zip: combinedInfo.zip || pageInfo.zip,
        phone: combinedInfo.phone || pageInfo.phone,
        email: combinedInfo.email || pageInfo.email,
        hours: combinedInfo.hours || pageInfo.hours,
        services: [...(combinedInfo.services || []), ...(pageInfo.services || [])],
        specialties: [...(combinedInfo.specialties || []), ...(pageInfo.specialties || [])],
        procedures: [...(combinedInfo.procedures || []), ...(pageInfo.procedures || [])],
        insurances: [...(combinedInfo.insurances || []), ...(pageInfo.insurances || [])],
        education: [...(combinedInfo.education || []), ...(pageInfo.education || [])],
        affiliations: [...(combinedInfo.affiliations || []), ...(pageInfo.affiliations || [])],
        emergencyInfo: combinedInfo.emergencyInfo || pageInfo.emergencyInfo,
        socialLinks: { ...(combinedInfo.socialLinks || {}), ...(pageInfo.socialLinks || {}) }
      };

      // Wait between requests
      await delay(2000);
    }

    // Remove duplicates from arrays
    if (combinedInfo.services) {
      combinedInfo.services = [...new Set(combinedInfo.services)];
    }
    if (combinedInfo.specialties) {
      combinedInfo.specialties = [...new Set(combinedInfo.specialties)];
    }
    if (combinedInfo.procedures) {
      combinedInfo.procedures = [...new Set(combinedInfo.procedures)];
    }
    if (combinedInfo.insurances) {
      combinedInfo.insurances = [...new Set(combinedInfo.insurances)];
    }
    if (combinedInfo.education) {
      combinedInfo.education = [...new Set(combinedInfo.education)];
    }
    if (combinedInfo.affiliations) {
      combinedInfo.affiliations = [...new Set(combinedInfo.affiliations)];
    }

    // Display results
    console.log('\nExtracted Business Information:');
    console.log('=============================');
    
    if (combinedInfo.name) console.log('Practice Name:', combinedInfo.name);
    if (combinedInfo.title) console.log('Page Title:', combinedInfo.title);
    if (combinedInfo.description) console.log('Description:', combinedInfo.description);
    
    console.log('\nContact Information:');
    console.log('-------------------');
    if (combinedInfo.address) console.log('Full Address:', combinedInfo.address);
    if (combinedInfo.city) console.log('City:', combinedInfo.city);
    if (combinedInfo.state) console.log('State:', combinedInfo.state);
    if (combinedInfo.zip) console.log('ZIP:', combinedInfo.zip);
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
      combinedInfo.services.forEach(service => console.log(`- ${service}`));
    }

    if (combinedInfo.procedures && combinedInfo.procedures.length > 0) {
      console.log('\nProcedures:');
      console.log('-----------');
      combinedInfo.procedures.forEach(proc => console.log(`- ${proc}`));
    }

    if (combinedInfo.specialties && combinedInfo.specialties.length > 0) {
      console.log('\nSpecialties:');
      console.log('------------');
      combinedInfo.specialties.forEach(specialty => console.log(`- ${specialty}`));
    }

    if (combinedInfo.education && combinedInfo.education.length > 0) {
      console.log('\nEducation:');
      console.log('----------');
      combinedInfo.education.forEach(edu => console.log(`- ${edu}`));
    }

    if (combinedInfo.affiliations && combinedInfo.affiliations.length > 0) {
      console.log('\nProfessional Affiliations:');
      console.log('------------------------');
      combinedInfo.affiliations.forEach(aff => console.log(`- ${aff}`));
    }

    if (combinedInfo.insurances && combinedInfo.insurances.length > 0) {
      console.log('\nInsurance Information:');
      console.log('---------------------');
      combinedInfo.insurances.forEach(insurance => console.log(`- ${insurance}`));
    }

    if (combinedInfo.emergencyInfo) {
      console.log('\nEmergency Information:');
      console.log('---------------------');
      console.log(combinedInfo.emergencyInfo);
    }
    
    if (combinedInfo.socialLinks && Object.keys(combinedInfo.socialLinks).length > 0) {
      console.log('\nSocial Media & Reviews:');
      console.log('----------------------');
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

// Only run if this is the main module
if (require.main === module) {
  const TEST_URL = process.argv[2] || 'https://about.google';
  testScrapeSystem(TEST_URL).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });
} 