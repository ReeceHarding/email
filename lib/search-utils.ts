"use server";

import { db } from '@/db/db';
import { processedUrlsTable } from '@/db/schema/processed-urls-schema';
import { eq } from 'drizzle-orm';

// In-memory quota tracking
let searchQuota = {
  remaining: 100, // Daily limit
  resetTime: new Date(new Date().setHours(24, 0, 0, 0)) // Reset at midnight
};

export async function checkQuota(): Promise<{ remaining: number; resetTime: Date }> {
  // Reset quota if past reset time
  if (new Date() > searchQuota.resetTime) {
    searchQuota = {
      remaining: 100,
      resetTime: new Date(new Date().setHours(24, 0, 0, 0))
    };
  }
  
  return searchQuota;
}

export async function decrementQuota(): Promise<void> {
  if (searchQuota.remaining > 0) {
    searchQuota.remaining--;
  }
}

export async function checkProcessedUrl(url: string): Promise<boolean> {
  try {
    const processed = await db.query.processedUrls.findFirst({
      where: eq(processedUrlsTable.url, url)
    });
    
    return !!processed;
  } catch (error) {
    console.error('[URL-CHECK] Error checking processed URL:', error);
    return false;
  }
}

export async function markUrlAsProcessed(url: string): Promise<void> {
  try {
    await db.insert(processedUrlsTable).values({ url });
  } catch (error) {
    console.error('[URL-CHECK] Error marking URL as processed:', error);
  }
}

// For testing purposes
export async function clearProcessedUrls(): Promise<void> {
  try {
    await db.delete(processedUrlsTable);
  } catch (error) {
    console.error('[URL-CHECK] Error clearing processed URLs:', error);
  }
} 