import axios from 'axios';
import { delay } from './utils';
import OpenAI from 'openai';
import { TeamMember } from './enhanced-scraper';
import "dotenv/config";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Constants
const MAX_SEARCH_RESULTS = 5;
const DELAY_BETWEEN_REQUESTS = 1000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

// API Key for search
const BRAVE_API_KEY = process.env.BRAVE_API_KEY || "";

export interface ContactInfo {
  email?: string;
  phone?: string;
  linkedin?: string;
  twitter?: string;
  instagram?: string;
  other_social?: string[];
  professional_details?: {
    role?: string;
    company?: string;
    experience?: string[];
    education?: string[];
    skills?: string[];
    certifications?: string[];
    specialties?: string[];
  };
  personal_details?: {
    location?: string;
    interests?: string[];
    bio?: string;
  };
  sources: string[];
}

export interface EnrichedTeamMember extends TeamMember {
  contactInfo?: ContactInfo;
  researchSummary?: string;
  researchFailed?: boolean;
}

// Define options for the research process
export interface ResearchOptions {
  maxSearchQueriesPerMember?: number;
  skipRetries?: boolean;
  rateLimitDelay?: number;
  location?: string;
}

/**
 * Main function to research team members and find detailed information
 */
export async function researchTeamMembers(
  teamMembers: TeamMember[],
  companyName: string,
  options?: ResearchOptions
): Promise<EnrichedTeamMember[]> {
  console.log(`[ContactResearch] Researching ${teamMembers.length} team members for ${companyName}`);
  
  const {
    maxSearchQueriesPerMember,
    skipRetries,
    rateLimitDelay = DELAY_BETWEEN_REQUESTS,
    location
  } = options || {};
  
  // Limit to avoid excessive API calls during development
  const targetMembers = teamMembers.slice(0, 5);
  
  const enrichedMembers: EnrichedTeamMember[] = [];
  
  for (const member of targetMembers) {
    console.log(`[ContactResearch] Researching ${member.name}`);
    try {
      // Gather raw data
      const contactInfo = await researchTeamMember(member, companyName, location, { maxSearchQueriesPerMember, skipRetries });
      
      // Create summary of findings
      const summary = await generateResearchSummary(member, contactInfo, companyName);
      
      // Add to enriched members
      enrichedMembers.push({
        ...member,
        contactInfo,
        researchSummary: summary
      });
      
      // Rate limiting
      await delay(rateLimitDelay);
      
    } catch (error: any) {
      console.error(`[ContactResearch] Error researching ${member.name}:`, error.message);
      // Still include the member even if research failed
      enrichedMembers.push({
        ...member,
        contactInfo: {
          sources: [],
          professional_details: { role: member.title }
        },
        researchSummary: `Research failed for ${member.name}.`,
        researchFailed: true
      });
    }
  }
  
  return enrichedMembers;
}

/**
 * Research a single team member to gather detailed information
 */
async function researchTeamMember(
  member: TeamMember,
  companyName: string,
  location?: string,
  options?: ResearchOptions
): Promise<ContactInfo> {
  const contactInfo: ContactInfo = {
    email: member.email,
    linkedin: member.linkedin,
    sources: []
  };
  
  // Create search queries for this person
  const queries = generateSearchQueries(member, companyName, location, options);
  
  // Gather all search results
  const allResults: Array<{ title: string; description: string; url: string }> = [];
  
  for (const query of queries) {
    try {
      console.log(`[ContactResearch] Searching for: ${query}`);
      const results = await searchWeb(query);
      allResults.push(...results);
      
      // Rate limiting
      await delay(DELAY_BETWEEN_REQUESTS);
    } catch (error) {
      console.error(`[ContactResearch] Search error for query "${query}":`, error);
    }
  }
  
  // Extract additional info from search results
  await extractInfoFromSearchResults(allResults, contactInfo, member);
  
  // If LinkedIn URL found but not in the original data, add it
  const linkedInUrl = findLinkedInURL(allResults, member.name);
  if (linkedInUrl && !contactInfo.linkedin) {
    contactInfo.linkedin = linkedInUrl;
  }
  
  return contactInfo;
}

/**
 * Generate search queries for a team member
 */
function generateSearchQueries(
  member: TeamMember,
  companyName: string,
  location?: string,
  options?: ResearchOptions
): string[] {
  const queries = [];
  
  // Basic query with name and company
  queries.push(`${member.name} ${companyName}`);
  
  // Add role if available
  if (member.title) {
    queries.push(`${member.name} ${member.title} ${companyName}`);
  }
  
  // Add location if available
  if (location) {
    queries.push(`${member.name} ${member.title || ''} ${location}`);
  }
  
  // Add LinkedIn specific query
  queries.push(`${member.name} ${companyName} linkedin`);
  
  // Contact information specific query
  queries.push(`${member.name} ${companyName} contact email`);
  
  return queries;
}

/**
 * Search the web using Brave Search API
 */
async function searchWeb(
  query: string
): Promise<Array<{ title: string; description: string; url: string }>> {
  if (!BRAVE_API_KEY) {
    console.warn("[ContactResearch] No Brave API key set, using fallback method");
    return await fallbackSearch(query);
  }
  
  try {
    const response = await axios.get("https://api.search.brave.com/res/v1/web/search", {
      params: {
        q: query,
        result_filter: "web",
        count: MAX_SEARCH_RESULTS,
        search_lang: "en"
      },
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY
      }
    });
    
    if (response.data && response.data.web && response.data.web.results) {
      return response.data.web.results.map((r: any) => ({
        title: r.title,
        description: r.description,
        url: r.url
      }));
    }
    
    return [];
  } catch (error) {
    console.error("[ContactResearch] Error with Brave search:", error);
    return await fallbackSearch(query);
  }
}

/**
 * Fallback search method (mock)
 */
async function fallbackSearch(
  query: string
): Promise<Array<{ title: string; description: string; url: string }>> {
  // In a real implementation, we could scrape Google or other search engines
  // For now, return empty results to avoid getting blocked
  console.log("[ContactResearch] Using fallback search (no results)");
  return [];
}

/**
 * Extract information from search results
 */
async function extractInfoFromSearchResults(
  results: Array<{ title: string; description: string; url: string }>,
  contactInfo: ContactInfo,
  member: TeamMember
): Promise<void> {
  // Use OpenAI to extract structured information from the search results
  const resultsText = results.map(r => 
    `Title: ${r.title}\nDescription: ${r.description}\nURL: ${r.url}`
  ).join('\n\n');
  
  if (resultsText.trim().length === 0) {
    console.log("[ContactResearch] No search results to analyze");
    return;
  }
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: `You are an expert at extracting structured information about professionals from search results. 
Extract relevant information about the person without fabricating details. 
If you're not confident about a piece of information, do not include it.
Focus on professional details, contact information, and relevant background.`
        },
        { 
          role: "user", 
          content: `Extract structured information about ${member.name} from these search results.
The person works at or is associated with ${member.title || 'a company'}. 
Find details like contact information, professional experience, education, and personal details if available.

SEARCH RESULTS:
${resultsText}

Format your response as JSON with the following structure:
{
  "email": "extracted email if found",
  "phone": "extracted phone if found",
  "linkedin": "full LinkedIn URL if found",
  "twitter": "Twitter handle or URL if found",
  "instagram": "Instagram handle or URL if found",
  "professional_details": {
    "role": "current role",
    "company": "current company",
    "experience": ["list of past roles or experiences"],
    "education": ["list of educational qualifications"],
    "skills": ["list of professional skills"],
    "certifications": ["list of certifications"]
  },
  "personal_details": {
    "location": "person's location",
    "interests": ["personal or professional interests if mentioned"],
    "bio": "short biography"
  },
  "sources": ["list of URLs where information was found"]
}

Only include fields where you found reliable information. Leave others out.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.log("[ContactResearch] No content in OpenAI response");
      return;
    }

    try {
      const extractedInfo = JSON.parse(content);
      
      // Merge extracted info with existing contactInfo
      if (extractedInfo.email) contactInfo.email = extractedInfo.email;
      if (extractedInfo.phone) contactInfo.phone = extractedInfo.phone;
      if (extractedInfo.linkedin) contactInfo.linkedin = extractedInfo.linkedin;
      if (extractedInfo.twitter) contactInfo.twitter = extractedInfo.twitter;
      if (extractedInfo.instagram) contactInfo.instagram = extractedInfo.instagram;
      
      if (extractedInfo.professional_details) {
        contactInfo.professional_details = {
          ...contactInfo.professional_details,
          ...extractedInfo.professional_details
        };
      }
      
      if (extractedInfo.personal_details) {
        contactInfo.personal_details = {
          ...contactInfo.personal_details,
          ...extractedInfo.personal_details
        };
      }
      
      if (extractedInfo.sources && Array.isArray(extractedInfo.sources)) {
        contactInfo.sources = [...new Set([...contactInfo.sources, ...extractedInfo.sources])];
      }
      
    } catch (parseError) {
      console.error("[ContactResearch] Error parsing extracted info:", parseError);
    }
  } catch (error) {
    console.error("[ContactResearch] Error calling OpenAI:", error);
  }
}

/**
 * Find LinkedIn URL from search results
 */
function findLinkedInURL(
  results: Array<{ title: string; description: string; url: string }>,
  name: string
): string | undefined {
  // Look for LinkedIn URLs that might contain the person's name
  const nameInUrl = name.toLowerCase().replace(/\s+/g, "-");
  
  for (const result of results) {
    if (result.url.includes('linkedin.com/in/')) {
      // Check if name is in the URL or title
      if (result.url.toLowerCase().includes(nameInUrl) || 
          result.title.toLowerCase().includes(name.toLowerCase())) {
        return result.url;
      }
    }
  }
  
  return undefined;
}

/**
 * Generate a human-readable summary of the research findings
 */
async function generateResearchSummary(
  member: TeamMember,
  contactInfo: ContactInfo,
  companyName: string
): Promise<string> {
  const infoJSON = JSON.stringify({
    name: member.name,
    title: member.title,
    companyName: companyName,
    contactInfo: contactInfo
  }, null, 2);
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: `You are an expert at creating concise professional summaries based on gathered information.
Create a 2-3 paragraph summary highlighting the most important aspects of the person's professional background, 
contact details, and any unique insights. Write in a professional, neutral tone.` 
        },
        { 
          role: "user", 
          content: `Create a concise professional summary of this person based on the research data:
          
${infoJSON}

Include only information that appears to be factual based on the sources. 
Do not fabricate or assume information that isn't provided.
Focus on their professional background, current role, expertise, and contact methods.` 
        }
      ],
      temperature: 0.3
    });

    return response.choices[0]?.message?.content || "No summary available.";
  } catch (error) {
    console.error("[ContactResearch] Error generating summary:", error);
    return `${member.name} is associated with ${companyName}${member.title ? ` as ${member.title}` : ''}.`;
  }
} 