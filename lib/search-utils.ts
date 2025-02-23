"use server";

import { db } from '@/db/db';
import { processedUrlsTable } from '@/db/schema/processed-urls-schema';
import { eq } from 'drizzle-orm';

// In-memory storage for processed URLs (in a real app, use Redis/DB)
const processedUrls = new Set<string>()

// In-memory quota tracking (in a real app, use Redis/DB)
let currentQuota = 0
const MONTHLY_QUOTA = 1000 // Example quota limit

export async function checkQuota(): Promise<boolean> {
  // In a real app, this would check a persistent store
  return currentQuota < MONTHLY_QUOTA
}

export async function incrementQuota(): Promise<void> {
  // Increment the quota counter
  // This is a placeholder - implement actual quota tracking as needed
  console.log('Incrementing quota');
}

export async function checkProcessedUrl(url: string): Promise<boolean> {
  // In a real app, this would check a persistent store
  return processedUrls.has(url)
}

export async function markUrlAsProcessed(url: string): Promise<void> {
  // In a real app, this would use a persistent store
  processedUrls.add(url)
}

export async function clearProcessedUrls(): Promise<void> {
  // In a real app, this would clear the persistent store
  processedUrls.clear()
  currentQuota = 0
}

// For testing purposes
let mockSearchFunction: ((query: string) => Promise<any>) | null = null

export async function setSearchFunction(mock: typeof mockSearchFunction): Promise<void> {
  mockSearchFunction = mock
}

export async function getSearchFunction(): Promise<typeof mockSearchFunction> {
  return mockSearchFunction
} 