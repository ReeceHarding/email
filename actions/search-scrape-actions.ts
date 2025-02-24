"use server"

import { ActionState } from "@/types";
import { runSearchAndScrapeProcess, SearchCriteria, ScrapeProcessProgress } from "@/lib/scrape-controller";
import { BusinessData } from "@/lib/enhanced-scraper";
import { EnrichedTeamMember } from "@/lib/contact-research";
import { GeneratedEmail } from "@/lib/content-generation";
import { auth } from "@clerk/nextjs/server";

type ScrapeProgress = {
  status: string;
  processingStep: string;
  completion: number;
  detail?: string;
  error?: string;
};

let currentProgress: Record<string, ScrapeProcessProgress> = {};

// Globally store progress for active processes by userId
export function getProgressForUser(userId: string): ScrapeProcessProgress | null {
  return currentProgress[userId] || null;
}

/**
 * Start a search and scrape process
 */
export async function startScrapeProcessAction(
  criteria: SearchCriteria
): Promise<ActionState<{
  processId: string;
  initialStatus: ScrapeProcessProgress;
}>> {
  try {
    // Get the current user ID - make sure to await auth()
    const session = await auth();
    const userId = session.userId;
    
    if (!userId) {
      return { 
        isSuccess: false, 
        message: "Authentication required"
      };
    }
    
    console.log(`[SearchScrapeAction] Starting process for user ${userId} with criteria:`, criteria);
    
    // Generate a unique process ID
    const processId = `${userId}-${Date.now()}`;
    
    // Start the process asynchronously
    const processPromise = runSearchAndScrapeProcess(
      userId,
      criteria,
      (progress) => {
        // Update the stored progress
        currentProgress[userId] = progress;
        console.log(`[SearchScrapeAction] Progress update:`, 
          progress.status, 
          `${progress.processedSites}/${progress.totalSites} sites`
        );
      }
    );
    
    // Don't await the promise - let it run in the background
    // This is intentional as the process may take a while
    processPromise.catch(error => {
      console.error(`[SearchScrapeAction] Error in background process:`, error);
      
      // Update the progress with the error
      if (currentProgress[userId]) {
        currentProgress[userId].status = 'failed';
        currentProgress[userId].error = error.message || "Unknown error";
      }
    });
    
    // Return initial status
    const initialStatus: ScrapeProcessProgress = {
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
    
    // Store initial progress
    currentProgress[userId] = initialStatus;
    
    return {
      isSuccess: true,
      message: "Search and scrape process started",
      data: {
        processId,
        initialStatus
      }
    };
  } catch (error: any) {
    console.error(`[SearchScrapeAction] Failed to start scrape process:`, error);
    return {
      isSuccess: false,
      message: `Failed to start scrape process: ${error.message}`
    };
  }
}

/**
 * Get the current progress of a scrape process
 */
export async function getScrapeProgressAction(): Promise<ActionState<ScrapeProcessProgress | null>> {
  try {
    // Get the current user ID - make sure to await auth()
    const session = await auth();
    const userId = session.userId;
    
    if (!userId) {
      return { 
        isSuccess: false, 
        message: "Authentication required"
      };
    }
    
    const progress = getProgressForUser(userId);
    
    return {
      isSuccess: true,
      message: "Progress retrieved successfully",
      data: progress
    };
  } catch (error: any) {
    console.error(`[SearchScrapeAction] Failed to get progress:`, error);
    return {
      isSuccess: false,
      message: `Failed to get progress: ${error.message}`
    };
  }
}

/**
 * Format the progress into a user-friendly format
 */
export function formatProgress(progress: ScrapeProcessProgress): ScrapeProgress {
  if (!progress) {
    return {
      status: "not_started",
      processingStep: "Not started",
      completion: 0
    };
  }
  
  // Calculate overall completion percentage
  let completion = 0;
  let processingStep = "";
  
  switch (progress.status) {
    case "initializing":
      processingStep = "Initializing";
      completion = 5;
      break;
      
    case "generating_queries":
      processingStep = "Generating search queries";
      completion = 10;
      break;
      
    case "searching":
      processingStep = "Searching for businesses";
      completion = 20;
      break;
      
    case "scraping":
      processingStep = "Scraping websites";
      completion = progress.totalSites > 0 
        ? 20 + (progress.processedSites / progress.totalSites) * 30
        : 25;
      break;
      
    case "enriching":
      processingStep = "Researching contacts";
      completion = 50 + (progress.enrichedContacts / Math.max(1, progress.foundTeamMembers)) * 30;
      break;
      
    case "generating_emails":
      processingStep = "Generating email content";
      completion = 80 + (progress.generatedEmails / Math.max(1, progress.enrichedContacts)) * 15;
      break;
      
    case "completed":
      processingStep = "Process completed";
      completion = 100;
      break;
      
    case "failed":
      processingStep = "Process failed";
      completion = 0;
      break;
      
    default:
      processingStep = "Processing";
      completion = 50;
  }
  
  // Cap completion at 100%
  completion = Math.min(Math.round(completion), 100);
  
  return {
    status: progress.status,
    processingStep,
    completion,
    detail: progress.currentSite,
    error: progress.error
  };
}

/**
 * A simplified action to run the entire process synchronously (for testing)
 */
export async function runScrapeProcessAction(
  criteria: SearchCriteria
): Promise<ActionState<{
  businesses: BusinessData[];
  teamMembers: EnrichedTeamMember[];
  emails: GeneratedEmail[];
}>> {
  try {
    // Get the current user ID - make sure to await auth()
    const session = await auth();
    const userId = session.userId;
    
    if (!userId) {
      return { 
        isSuccess: false, 
        message: "Authentication required"
      };
    }
    
    console.log(`[SearchScrapeAction] Running process for user ${userId} with criteria:`, criteria);
    
    // Run the process synchronously (for testing/development)
    const result = await runSearchAndScrapeProcess(
      userId,
      criteria,
      (progress) => {
        // Update the stored progress
        currentProgress[userId] = progress;
        console.log(`[SearchScrapeAction] Progress update:`, 
          progress.status, 
          `${progress.processedSites}/${progress.totalSites} sites`
        );
      }
    );
    
    return {
      isSuccess: true,
      message: "Search and scrape process completed",
      data: {
        businesses: result.businesses,
        teamMembers: result.teamMembers,
        emails: result.emails
      }
    };
  } catch (error: any) {
    console.error(`[SearchScrapeAction] Failed to run scrape process:`, error);
    return {
      isSuccess: false,
      message: `Failed to run scrape process: ${error.message}`
    };
  }
} 