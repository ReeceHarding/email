import Firecrawl from "@mendable/firecrawl-js";
import * as cheerio from "cheerio";

if (!process.env.FIRECRAWL_API_KEY) {
  console.error("FIRECRAWL_API_KEY is not set in environment variables");
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
  extractedText?: string;     // <-- Instead of storing full HTML, we store only text
  businessData?: ScrapedBusinessData;
}

export interface ScrapedBusinessData {
  businessName?: string;
  description?: string;
  website?: string;
  contactEmail?: string;
  phoneNumber?: string;
  address?: string;
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
  rawHtml?: string;
  rawText?: string;
}

function cleanHtml(html: string): string {
  // Optionally remove any script or style or head tags to reduce noise
  const $ = cheerio.load(html);
  $("script, style, head, iframe, noscript").remove();
  return $.html();
}

function extractVisibleText(html: string): string {
  // This function uses cheerio to get main textual content from the body
  // removing script, style, head tags above, then get the text from body
  const $ = cheerio.load(html);
  $("script, style, head, iframe, noscript").remove();
  // We can also remove nav, footer, etc. if we want to prune further:
  // $("nav, footer").remove();
  const bodyText = $("body").text() || "";
  // Convert multiple spaces or newlines to a single space
  const cleaned = bodyText
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

/**
 * Attempt to extract some data from HTML, to store in businessData
 */
function extractFromHtml(html: string, metadata?: Record<string, any>): Partial<ScrapedBusinessData> {
  const data: Partial<ScrapedBusinessData> = {};
  // we can do a quick approach
  // parse the HTML to see if there's an og:site_name or title
  try {
    const $ = cheerio.load(html);
    // site name or title
    const ogSiteName = $('meta[property="og:site_name"]').attr("content");
    if (ogSiteName) {
      data.businessName = ogSiteName.trim();
    } else {
      const title = $("title").text().trim();
      if (title && title.length > 0) {
        data.businessName = title;
      }
    }
  } catch (err) {
    console.error("[extractFromHtml] error extracting basic info:", err);
  }
  return data;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Updated function: store only the extracted main text, not the entire HTML
export async function scrapeWebsite(url: string, options: { retries?: number; maxDepth?: number; } = {}): Promise<ScrapeResult> {
  console.log("[firecrawl] scrapeWebsite called:", { url });
  try {
    const response = await firecrawl.scrapeUrl(url, {
      formats: ["html"],
      proxy: "stealth"
    });
    
    if (!response || !response.success) {
      console.log("[firecrawl] Firecrawl request failed for", url);
      return {
        success: false,
        error: {
          code: "FIRECRAWL_FAILED",
          message: "Firecrawl returned no success"
        }
      };
    }
    
    console.log("[firecrawl] Successfully scraped. Response:", response);

    // Instead of storing full HTML, we store just the main text:
    const cleaned = cleanHtml(response.html || "");
    const visibleText = extractVisibleText(cleaned);

    // Build final result
    return {
      success: true,
      extractedText: visibleText,
      businessData: {
        website: url,
        rawText: visibleText
      }
    };
  } catch (error: any) {
    console.error("[firecrawl] Error scraping url:", url, error);
    return {
      success: false,
      error: {
        code: "SCRAPE_ERROR",
        message: error.message
      }
    };
  }
} 