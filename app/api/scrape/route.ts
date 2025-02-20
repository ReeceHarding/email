"use server"

import { ScrapeQueue } from '@/lib/queue/scrape-queue';
import { ScrapeWorker } from '@/lib/scraping/worker';
import { ScrapingConfig } from '@/lib/scraping/page-discovery';

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const { userId, url } = await req.json();
    
    // Validate input
    if (!userId || typeof userId !== 'string') {
      return new Response('Invalid userId', { status: 400 });
    }
    
    if (!url || typeof url !== 'string' || !isValidUrl(url)) {
      return new Response('Invalid URL', { status: 400 });
    }
    
    // Create scraping job
    const queue = new ScrapeQueue();
    
    const config: ScrapingConfig = {
      maxPages: 1000,
      maxDepth: 5,
      priorityThreshold: 3,
      allowedDomains: [new URL(url).hostname],
      excludePatterns: [
        /\.(jpg|jpeg|png|gif|css|js)$/i,
        /\/(tag|category|author)\//i,
        /\?/
      ],
      rateLimit: 2, // 2 requests per second
      timeout: 30000 // 30 seconds
    };
    
    const jobId = await queue.addJob(userId, url);
    
    // Start worker if not already running
    // Note: In production, you'd want a separate worker process
    new ScrapeWorker(config, queue).start();
    
    return new Response(JSON.stringify({ jobId }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating scrape job:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 