import Firecrawl from "@mendable/firecrawl-js";
import * as cheerio from "cheerio";
import puppeteer, { Page } from "puppeteer";

/**
 * Additional logging for every relevant step, plus more thorough team scraping.
 * We store only textual content in businessData.rawText, skipping raw HTML.
 */

let firecrawl: Firecrawl | undefined;

function getFirecrawlClient(): Firecrawl {
  if (!firecrawl) {
    const API_KEY = process.env.FIRECRAWL_API_KEY;
    if (!API_KEY) {
      throw new Error("[firecrawl] Missing FIRECRAWL_API_KEY in environment");
    }
    firecrawl = new Firecrawl({ apiKey: API_KEY });
  }
  return firecrawl;
}

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
  extractedText?: string; // Instead of storing raw HTML, we store only text
  businessData?: ScrapedBusinessData;
}

export interface TeamMember {
  name: string;
  title?: string;
  email?: string;
  linkedin?: string;
  bio?: string;
}

export interface ScrapedBusinessData {
  businessName?: string;
  description?: string;
  website?: string;
  contactEmail?: string;
  phoneNumber?: string;
  address?: string;
  founders?: TeamMember[];
  teamMembers?: TeamMember[];
  socialMedia?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
  industry?: string;
  yearFounded?: string;
  companySize?: string;
  businessHours?: {
    [key: string]: string;
  };
  allEmails?: string[];
  scrapedPages?: {
    url: string;
    title?: string;
    type?: "about" | "team" | "contact" | "other";
  }[];
  rawText?: string; // Only text, no HTML
}

function cleanHtml(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, head, iframe, noscript").remove();
  return $.html();
}

function extractVisibleText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, head, iframe, noscript").remove();
  const bodyText = $("body").text() || "";
  const cleaned = bodyText.replace(/\s+/g, " ").trim();
  return cleaned;
}

/**
 * Attempt to find named individuals. We do a more robust approach:
 *  - Look for typical patterns like "Jane Doe" (capitalized pairs)
 *  - Handle common titles (Dr., Mr., Mrs., etc.) and suffixes (Jr., Sr., etc.)
 *  - Extract roles/titles more precisely
 *  - Filter out common false positives and duplicates
 */
export function extractTeamMembers(text: string): TeamMember[] {
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
    "Learn More",
    "Senior Manager",
    "Lead Developer",
    "Chief Technology",
    "Chief Executive",
    "Chief Financial",
    "Chief Operating",
    "Vice President",
    "Board Member",
    "Board Advisor",
    "Product Development",
    "Senior Researcher"
  ]);

  // More comprehensive title regex
  const titleRegex = /\b(CEO|Founder|Co-Founder|Owner|President|Manager|Director|Doctor|MD|DDS|Chiropractor|Officer|Lead|Head|VP|Vice President|Chief|Partner|Principal|Supervisor|Executive|Coordinator|Specialist|Consultant|Advisor|Chairman|Chairwoman|Chair|Professor|Dr\.|Mr\.|Mrs\.|Ms\.|Senior|Junior|Sr\.|Jr\.)\b/i;

  // More comprehensive name regex that handles titles and suffixes
  const nameRegex = /\b(?:(?:Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.|Rev\.|Sr\.|Jr\.|[A-Z]\.)\s+)?([A-Z][a-z]+(?:-[A-Z][a-z]+)?)\s+([A-Z][a-z]+(?:-[A-Z][a-z]+)?(?:\s+(?:Sr\.|Jr\.|III|IV|II))?)\b(?:\s+(?:Sr\.|Jr\.|III|IV|II))?/g;

  // Email regex
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;

  // LinkedIn regex - more permissive to catch various formats
  const linkedinRegex = /(?:linkedin(?:\.com)?:?\s*)?(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|profile)\/([a-zA-Z0-9-]+)/i;

  for (const line of lines) {
    const matches = Array.from(line.matchAll(nameRegex));
    
    for (const match of matches) {
      // Get the full name including any suffix
      const fullName = match[0].trim();
      
      // Skip if we've seen this name or it's in our false positives list
      if (seenNames.has(fullName) || falsePositives.has(fullName)) {
        continue;
      }

      // Extract title if present
      const roleMatch = line.match(titleRegex);
      let title: string | undefined = undefined;
      
      // Look for role context after a hyphen, comma, or "as"
      const roleContext = line.match(/[-:,]\s*([^,\n]*?)(?:,|\n|$)/i);
      if (roleContext && roleContext[1]) {
        title = roleContext[1].trim();
        
        // Clean up title
        title = title
          .replace(/^(and|&)\s+/i, '')  // Remove leading "and" or "&"
          .replace(/\s+(?:and|&)\s+/g, ' & ') // Standardize " and " to " & "
          .replace(/\s{2,}/g, ' ') // Remove extra spaces
          .replace(/\s*[-–]\s*/g, ' - '); // Standardize hyphens
      }
      // If no role context but we found a title, use that
      else if (roleMatch) {
        title = roleMatch[0].trim();
        if (title.endsWith('.')) {
          title = title.slice(0, -1);
        }
      }

      // Expand common abbreviations in title, but keep original form for CEO
      if (title) {
        title = title
          .replace(/\bVP\b/g, 'Vice President')
          .replace(/\bCTO\b/g, 'Chief Technology Officer')
          .replace(/\bCFO\b/g, 'Chief Financial Officer')
          .replace(/\bCOO\b/g, 'Chief Operating Officer')
          .replace(/\bDr\b/g, 'Doctor')
          .replace(/\bProf\b/g, 'Professor');

        // Special case for CEO to keep both forms
        if (title.includes('CEO')) {
          title = title.replace(/\bCEO\b/g, 'CEO (Chief Executive Officer)');
        }

        // Remove any name parts that got into the title (like with hyphenated names)
        const nameParts = fullName.split(/[-\s]+/); // Split on both spaces and hyphens
        for (const part of nameParts) {
          title = title.replace(new RegExp(`\\b${part}\\b`, 'g'), '').trim();
        }

        // Clean up any leftover artifacts
        title = title
          .replace(/^\s*[-–]\s*/, '') // Remove leading hyphen
          .replace(/\s*[-–]\s*$/, '') // Remove trailing hyphen
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();
      }

      // Extract email from the current and nearby lines
      let email: string | undefined = undefined;
      const nearbyLines = [
        lines[lines.indexOf(line) - 2] || '',
        lines[lines.indexOf(line) - 1] || '',
        line,
        lines[lines.indexOf(line) + 1] || '',
        lines[lines.indexOf(line) + 2] || ''
      ].join('\n');

      const emailMatch = nearbyLines.match(emailRegex);
      if (emailMatch) {
        email = emailMatch[0];
      }

      // Extract LinkedIn from nearby lines
      let linkedin: string | undefined = undefined;
      const linkedinMatch = nearbyLines.match(linkedinRegex);
      if (linkedinMatch) {
        const path = linkedinMatch[1];
        linkedin = `https://www.linkedin.com/in/${path}`;
      }

      found.push({
        name: fullName,
        title,
        email,
        linkedin,
        bio: line.trim()
      });

      seenNames.add(fullName);
    }
  }

  return found;
}

function extractFromHtml(html: string): Partial<ScrapedBusinessData> {
  try {
    const $ = cheerio.load(html);
    // site name or title
    const ogSiteName = $('meta[property="og:site_name"]').attr("content");
    let siteTitle = "";
    if (ogSiteName) {
      siteTitle = ogSiteName.trim();
    } else {
      const title = $("title").text().trim();
      if (title && title.length > 0) {
        siteTitle = title;
      }
    }

    // This returns partial data; more advanced logic can be added
    return {
      businessName: siteTitle
    };
  } catch (err) {
    console.error("[firecrawl] extractFromHtml error:", err);
    return {};
  }
}

async function fallbackScrapeWithPuppeteer(url: string): Promise<ScrapeResult> {
  console.log("[firecrawl] Using Puppeteer fallback for:", url);
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    await page.setDefaultNavigationTimeout(30000);

    console.log("[firecrawl] Puppeteer navigating to:", url);
    await page.goto(url, { waitUntil: "networkidle0" });
    const content = await page.content();
    const cleaned = cleanHtml(content);
    const visibleText = extractVisibleText(cleaned);
    const partialData = extractFromHtml(cleaned);

    // Additional step: parse entire text for team members
    const teamFound = extractTeamMembers(visibleText);

    // Additionally parse contact info
    const phoneRegex = /(\+\d{1,2}\s?)?\(?\d{3}\)?[-\s.]?\d{3}[-\s.]?\d{4}/;
    const phoneMatch = visibleText.match(phoneRegex);
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const emailMatch = visibleText.match(emailRegex);

    return {
      success: true,
      extractedText: visibleText,
      businessData: {
        website: url,
        rawText: visibleText,
        ...partialData,
        contactEmail: emailMatch ? emailMatch[0] : undefined,
        phoneNumber: phoneMatch ? phoneMatch[0] : undefined,
        // We'll store all found team members under teamMembers
        teamMembers: teamFound && teamFound.length ? teamFound : []
      }
    };
  } catch (error: any) {
    console.error("[firecrawl] Puppeteer fallback error for URL:", url, error);
    return {
      success: false,
      error: {
        code: "PUPPETEER_ERROR",
        message: error.message
      }
    };
  } finally {
    if (browser) {
      await browser.close();
      console.log("[firecrawl] Puppeteer browser closed for:", url);
    }
  }
}

export async function scrapeWebsite(
  url: string,
  options: { retries?: number; maxDepth?: number } = {}
): Promise<ScrapeResult> {
  console.log("[firecrawl] scrapeWebsite called:", { url });
  const maxRetries = options.retries || 3;
  let attempt = 0;
  let lastError: any;

  while (attempt < maxRetries) {
    try {
      const client = getFirecrawlClient();
      const response = await client.scrapeUrl(url, {
        formats: ["html"],
        proxy: attempt === 0 ? "stealth" : "basic", // Try stealth first, then basic
        timeout: 60000, // Increase timeout to 60 seconds
        waitFor: 5000, // Wait for 5 seconds after page load
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });

      if (!response || !response.success) {
        throw new Error("Firecrawl request failed");
      }

      console.log("[firecrawl] Firecrawl success. Converting raw HTML to text for:", url);
      const cleaned = cleanHtml(response.html || "");
      const visibleText = extractVisibleText(cleaned);
      const partialData = extractFromHtml(cleaned);

      const teamFound = extractTeamMembers(visibleText);

      const phoneRegex = /(\+\d{1,2}\s?)?\(?\d{3}\)?[-\s.]?\d{3}[-\s.]?\d{4}/;
      const phoneMatch = visibleText.match(phoneRegex);
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const emailMatch = visibleText.match(emailRegex);

      return {
        success: true,
        extractedText: visibleText,
        businessData: {
          website: url,
          rawText: visibleText,
          ...partialData,
          contactEmail: emailMatch ? emailMatch[0] : undefined,
          phoneNumber: phoneMatch ? phoneMatch[0] : undefined,
          teamMembers: teamFound && teamFound.length ? teamFound : []
        }
      };
    } catch (error: any) {
      console.error(`[firecrawl] Error on attempt ${attempt + 1}/${maxRetries} for url:`, url, error);
      lastError = error;
      
      // Don't retry on certain status codes
      if (error.statusCode === 403 || error.statusCode === 404) {
        break;
      }
      
      // Add exponential backoff delay
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[firecrawl] Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      attempt++;
      continue;
    }
  }

  // If we exhausted retries or got a permanent error, try Puppeteer
  console.warn("[firecrawl] All attempts failed, switching to Puppeteer fallback for:", url);
  return fallbackScrapeWithPuppeteer(url);
} 