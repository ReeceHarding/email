import OpenAI from 'openai';
import { BusinessData } from './enhanced-scraper';
import { EnrichedTeamMember, researchTeamMembers } from './contact-research';
import { GeneratedEmail, generateEmailContent } from './content-generation';
import * as scraper from './enhanced-scraper';
import * as db from '@/actions/db/business-profiles-actions';
import * as leadsDb from '@/actions/db/leads-actions';
import { search } from './search-service';
import "dotenv/config";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Define missing types
export interface ScrapeSite {
  url: string;
}

export interface ScrapeResult {
  success: boolean;
  businessData?: BusinessData;
  error?: string;
}

export interface SearchCriteria {
  businessType: string;
  location?: string;
  industry?: string;
  targetAudience?: string;
  companySize?: string;
  additionalKeywords?: string[];
  excludeKeywords?: string[];
  maxResults?: number;
}

export interface ScrapeProcessProgress {
  status: 'initializing' | 'generating_queries' | 'searching' | 'scraping' | 'enriching' | 'generating_emails' | 'completed' | 'failed';
  totalSites: number;
  processedSites: number;
  successfulScrapes: number;
  failedScrapes: number;
  foundBusinessProfiles: number;
  foundTeamMembers: number;
  enrichedContacts: number;
  generatedEmails: number;
  currentSite?: string;
  error?: string;
  timeTaken?: number;
}

const DEFAULT_MAX_RESULTS = 5;

/**
 * Generate search queries based on criteria
 */
async function generateSearchQueries(criteria: SearchCriteria): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are an expert at generating effective search queries for business research. Create a list of search queries that will help find relevant business websites." 
        },
        { 
          role: "user", 
          content: `Generate 3-5 search queries to find businesses matching these criteria:
          
Business Type: ${criteria.businessType}
${criteria.location ? `Location: ${criteria.location}` : ''}
${criteria.industry ? `Industry: ${criteria.industry}` : ''}
${criteria.targetAudience ? `Target Audience: ${criteria.targetAudience}` : ''}
${criteria.companySize ? `Company Size: ${criteria.companySize}` : ''}
${criteria.additionalKeywords?.length ? `Additional Keywords: ${criteria.additionalKeywords.join(', ')}` : ''}
${criteria.excludeKeywords?.length ? `Exclude Keywords: ${criteria.excludeKeywords.join(', ')}` : ''}

Format your response as a simple list of search queries without numbering or explanation.
Each query should be specific enough to find relevant businesses but not so narrow that it limits results.
Include location if provided.` 
        }
      ],
      temperature: 0.7
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return [criteria.businessType];
    }

    // Parse the response into separate queries
    const queries = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    return queries.length > 0 ? queries : [criteria.businessType];
  } catch (error) {
    console.error("Error generating search queries:", error);
    // Fallback to a basic query
    return [criteria.businessType];
  }
}

/**
 * Main controller function to orchestrate the search and scrape process
 */
export async function runSearchAndScrapeProcess(
  userId: string,
  criteria: SearchCriteria,
  progressCallback?: (progress: ScrapeProcessProgress) => void
): Promise<{
  businesses: BusinessData[];
  teamMembers: EnrichedTeamMember[];
  emails: GeneratedEmail[];
  progress: ScrapeProcessProgress;
}> {
  const startTime = Date.now();
  const maxResults = criteria.maxResults || DEFAULT_MAX_RESULTS;
  
  // Initialize progress
  const progress: ScrapeProcessProgress = {
    status: 'initializing',
    totalSites: 0,
    processedSites: 0,
    successfulScrapes: 0,
    failedScrapes: 0,
    foundBusinessProfiles: 0,
    foundTeamMembers: 0,
    enrichedContacts: 0,
    generatedEmails: 0
  };
  
  updateProgress(progress, progressCallback);
  
  const businesses: BusinessData[] = [];
  const allTeamMembers: EnrichedTeamMember[] = [];
  const emails: GeneratedEmail[] = [];
  
  try {
    // Step 1: Generate search queries based on criteria
    progress.status = 'generating_queries';
    updateProgress(progress, progressCallback);
    
    const searchQueries = await generateSearchQueries(criteria);
    
    // Step 2: Perform search for each query
    progress.status = 'searching';
    updateProgress(progress, progressCallback);
    
    const sitesToScrape: ScrapeSite[] = [];
    
    for (const query of searchQueries) {
      // Use the search function from search-service.ts
      const searchResults = await search(query);
      
      // Add unique URLs to the list
      for (const result of searchResults) {
        if (
          !sitesToScrape.some(site => site.url === result.url) && 
          sitesToScrape.length < maxResults
        ) {
          sitesToScrape.push({ url: result.url });
        }
        
        if (sitesToScrape.length >= maxResults) break;
      }
      
      if (sitesToScrape.length >= maxResults) break;
    }
    
    progress.totalSites = sitesToScrape.length;
    updateProgress(progress, progressCallback);
    
    // Step 3: Scrape each site
    progress.status = 'scraping';
    updateProgress(progress, progressCallback);
    
    for (const site of sitesToScrape) {
      progress.currentSite = site.url;
      updateProgress(progress, progressCallback);
      
      try {
        const result = await scraper.scrapeWebsite(site.url);
        
        if (result.success) {
          progress.successfulScrapes++;
          
          // Store business profile in database
          if (result.businessData) {
            businesses.push(result.businessData);
            progress.foundBusinessProfiles++;
            
            // Count team members if found
            if (result.businessData.teamMembers?.length) {
              progress.foundTeamMembers += result.businessData.teamMembers.length;
            }
            
            // Save business profile to database
            await saveBusinessProfile(userId, result.businessData);
          }
        } else {
          console.error(`Failed to scrape ${site.url}: ${result.error}`);
          progress.failedScrapes++;
        }
      } catch (error) {
        console.error(`Error scraping ${site.url}:`, error);
        progress.failedScrapes++;
      }
      
      progress.processedSites++;
      updateProgress(progress, progressCallback);
    }
    
    // Step 4: Enrich team member data with contact research
    progress.status = 'enriching';
    updateProgress(progress, progressCallback);
    
    for (const business of businesses) {
      if (business.teamMembers?.length) {
        try {
          const enrichedMembers = await researchTeamMembers(
            business.teamMembers,
            business.name,
            business.address
          );
          
          // Update the business with enriched team members
          business.teamMembers = enrichedMembers;
          
          // Add to overall list
          allTeamMembers.push(...enrichedMembers);
          
          // Update progress
          progress.enrichedContacts += enrichedMembers.length;
          updateProgress(progress, progressCallback);
          
          // Save leads to database
          await saveLeads(userId, business, enrichedMembers);
        } catch (error) {
          console.error(`Error enriching contacts for ${business.name}:`, error);
        }
      }
    }
    
    // Step 5: Generate email content for each contact
    if (allTeamMembers.length > 0) {
      progress.status = 'generating_emails';
      updateProgress(progress, progressCallback);
      
      // Get user info for email generation
      const userInfo = await getUserInfo(userId);
      
      for (const member of allTeamMembers) {
        if (member.email) {
          try {
            // Find the business this team member belongs to
            const business = businesses.find(b => 
              b.teamMembers?.some(m => m.name === member.name && m.title === member.title)
            );
            
            if (business) {
              const email = await generateEmailContent(
                business,
                member,
                userInfo
              );
              
              emails.push(email);
              progress.generatedEmails++;
              updateProgress(progress, progressCallback);
            }
          } catch (error) {
            console.error(`Error generating email for ${member.name}:`, error);
          }
        }
      }
    }
    
    // Complete the process
    progress.status = 'completed';
    progress.timeTaken = Date.now() - startTime;
    updateProgress(progress, progressCallback);
    
    return {
      businesses,
      teamMembers: allTeamMembers,
      emails,
      progress
    };
  } catch (error: any) {
    console.error("Search and scrape process failed:", error);
    
    progress.status = 'failed';
    progress.error = error.message || "Unknown error occurred";
    progress.timeTaken = Date.now() - startTime;
    updateProgress(progress, progressCallback);
    
    return {
      businesses,
      teamMembers: allTeamMembers,
      emails,
      progress
    };
  }
}

/**
 * Helper function to update progress and trigger callback
 */
function updateProgress(
  progress: ScrapeProcessProgress,
  callback?: (progress: ScrapeProcessProgress) => void
) {
  if (callback) {
    callback({ ...progress });
  }
}

/**
 * Save business profile to database
 */
async function saveBusinessProfile(
  userId: string, 
  business: BusinessData
): Promise<void> {
  try {
    // Corrected function signature based on actual implementation
    const result = await db.createBusinessProfile(
      business.website || '',
      {
        name: business.name,
        description: business.description,
        email: business.email,
        phone: business.phone,
        address: business.address,
        specialties: business.specialties,
        services: business.services,
        socialLinks: business.socialLinks
      }
    );
    
    if (!result.success) {
      console.error(`Failed to save business profile: ${result.message}`);
    }
  } catch (error) {
    console.error("Error saving business profile:", error);
  }
}

/**
 * Save leads to database
 */
async function saveLeads(
  userId: string, 
  business: BusinessData, 
  teamMembers: EnrichedTeamMember[]
): Promise<void> {
  try {
    for (const member of teamMembers) {
      if (!member.name) continue;
      
      // Map the data to match the expected structure
      const websiteUrl = business.website || '';
      const scrapedData = {
        businessName: business.name,
        description: business.description,
        industry: business.industries?.[0],
        contactEmail: member.email,
        phoneNumber: member.contactInfo?.phone,
        address: business.address,
        socialMedia: {
          linkedin: member.linkedin || member.contactInfo?.linkedin,
          twitter: member.contactInfo?.twitter,
          facebook: business.socialLinks?.facebook,
          instagram: business.socialLinks?.instagram
        },
        teamMembers: [
          {
            name: member.name,
            role: member.title,
            email: member.email,
            phone: member.contactInfo?.phone,
            bio: member.bio
          }
        ]
      };
      
      await leadsDb.createLead(userId, websiteUrl, scrapedData);
    }
  } catch (error) {
    console.error("Error saving leads:", error);
  }
}

/**
 * Get user information for email generation
 */
async function getUserInfo(userId: string): Promise<{
  name: string;
  company: string;
  title: string;
  email: string;
  phone: string;
}> {
  // This would typically come from your user profile
  // For now, return placeholder data
  return {
    name: "John Doe",
    company: "Example Company",
    title: "Sales Representative",
    email: "john@example.com",
    phone: "(555) 123-4567"
  };
} 