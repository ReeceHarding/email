import { ScrapeQueue, ScrapeJob } from '../queue/scrape-queue';
import { findPagesToScrape, ScrapingConfig } from './page-discovery';
import { scrapeWebsite } from '../firecrawl';
import { ScrapeStorage } from './storage';

export class ScrapeWorker {
  private config: ScrapingConfig;
  private queue: ScrapeQueue;
  private storage: ScrapeStorage;
  private lastRequestTime = 0;
  private retryDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff
  private domainFailures: Map<string, number> = new Map();
  private maxFailuresBeforeCircuitBreak = 5;
  private isRunning = false;
  private processedUrls = new Set<string>();
  
  constructor(config: ScrapingConfig, queue: ScrapeQueue) {
    this.config = config;
    this.queue = queue;
    this.storage = new ScrapeStorage();
  }
  
  async start() {
    if (this.isRunning) {
      console.log('[Worker] Already running');
      return;
    }
    
    this.isRunning = true;
    console.log('[Worker] Started');
    
    try {
      while (this.isRunning) {
        console.log('[Worker] Waiting for next job...');
        const jobId = await this.queue.getNextJobId();
        if (!jobId) {
          console.log('[Worker] No job available, waiting...');
          await new Promise(res => setTimeout(res, 2000));
          continue;
        }
        
        console.log(`[Worker] Got job ${jobId}, fetching details...`);
        const job = await this.queue.getJob(jobId);
        if (!job) {
          console.log(`[Worker] Job ${jobId} not found`);
          continue;
        }
        
        try {
          console.log(`[Worker] Processing job ${jobId} for URL ${job.baseUrl}`);
          await this.processJob(job);
        } catch (error) {
          console.error('[Worker] Failed to process job:', error);
          await this.queue.failJob(jobId, error instanceof Error ? error.message : 'Unknown error');
        }
      }
    } catch (error) {
      console.error('[Worker] Fatal error:', error);
      this.isRunning = false;
      throw error;
    }
  }
  
  async stop() {
    console.log('[Worker] Stopping...');
    this.isRunning = false;
  }
  
  private async processJob(job: ScrapeJob) {
    console.log(`[Worker] Starting job ${job.id}`);
    await this.queue.updateJob(job.id, { status: 'processing' });
    
    // Reset processed URLs for this job
    this.processedUrls.clear();
    
    try {
      // Start with the base URL
      await this.scrapeAndDiscover(job, job.baseUrl);
      
      // Process any remaining queued URLs
      while (job.pagesQueued.length > 0 && job.pagesScraped < this.config.maxPages) {
        const url = job.pagesQueued.shift()!;
        if (!this.processedUrls.has(url)) {
          await this.scrapeAndDiscover(job, url);
        }
        
        // Re-fetch job to get updated state
        const updatedJob = await this.queue.getJob(job.id);
        if (!updatedJob) {
          console.log(`[Worker] Job ${job.id} no longer exists`);
          return;
        }
        job = updatedJob;
      }
      
      await this.queue.completeJob(job.id);
      console.log(`[Worker] Job ${job.id} completed, pagesScraped=${job.pagesScraped}`);
    } catch (error) {
      console.error(`[Worker] Error processing job ${job.id}:`, error);
      await this.queue.failJob(job.id, error instanceof Error ? error.message : 'Unknown error');
    }
  }
  
  private async scrapeAndDiscover(job: ScrapeJob, url: string) {
    if (this.processedUrls.has(url)) {
      console.log(`[Worker] URL already processed: ${url}`);
      return;
    }
    
    const domain = new URL(url).hostname;
    console.log(`[Worker] Scraping ${url} (domain: ${domain})`);
    
    // Check circuit breaker
    if (this.isCircuitBroken(domain)) {
      console.log(`[Worker] Circuit broken for domain ${domain}, skipping ${url}`);
      return;
    }
    
    try {
      // Rate limiting
      await this.rateLimit();
      
      // Scrape with retries
      console.log(`[Worker] Starting scrape for ${url}`);
      const result = await this.scrapeWithRetries(url);
      
      if (!result.success || !result.html) {
        throw new Error('Scrape failed: ' + (result.error?.message || 'Unknown error'));
      }
      
      console.log(`[Worker] Scrape successful for ${url}`);
      
      // Reset failure count on success
      this.domainFailures.delete(domain);
      
      // Store data
      if (result.businessData) {
        console.log(`[Worker] Storing data for ${url}`);
        await this.storage.storePageData(job.userId, url, result.businessData);
      }
      
      // Mark URL as processed
      this.processedUrls.add(url);
      
      // Parse and queue child links
      console.log(`[Worker] Finding more pages to scrape from ${url}`);
      const discoveredPages = await findPagesToScrape(result.html, url, this.config);
      console.log(`[Worker] Found ${discoveredPages.length} new pages to scrape`);
      
      // Update job with new pages and increment counter
      await this.queue.incrementPagesScraped(job.id);
      
      // Queue new URLs if within limits
      if (job.pagesScraped < this.config.maxPages) {
        for (const page of discoveredPages) {
          if (page.depth <= this.config.maxDepth && !this.processedUrls.has(page.url)) {
            console.log(`[Worker] Queueing new URL: ${page.url} (priority: ${page.priority}, depth: ${page.depth})`);
            await this.queue.addUrlToJob(job.id, page.url);
          }
        }
      }
    } catch (error) {
      console.error(`[Worker] Error scraping ${url}:`, error);
      this.recordFailure(domain);
    }
  }
  
  private async scrapeWithRetries(url: string, attempt = 0): Promise<Awaited<ReturnType<typeof scrapeWebsite>>> {
    try {
      console.log(`[Worker] Scraping ${url} (attempt ${attempt + 1})`);
      return await scrapeWebsite(url, {
        retries: 0, // We handle retries here
        maxDepth: 1 // Only scrape the current page
      });
    } catch (error) {
      if (attempt >= this.retryDelays.length) {
        console.error(`[Worker] Max retries reached for ${url}`);
        throw error;
      }
      
      const delay = this.retryDelays[attempt];
      console.log(`[Worker] Retry ${attempt + 1} for ${url} after ${delay}ms`);
      await new Promise(res => setTimeout(res, delay));
      
      return this.scrapeWithRetries(url, attempt + 1);
    }
  }
  
  private async rateLimit() {
    if (this.config.rateLimit <= 0) return;
    
    const minIntervalMs = 1000 / this.config.rateLimit;
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    
    if (elapsed < minIntervalMs) {
      const waitTime = minIntervalMs - elapsed;
      console.log(`[Worker] Rate limiting: waiting ${waitTime}ms`);
      await new Promise(res => setTimeout(res, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }
  
  private recordFailure(domain: string) {
    const failures = (this.domainFailures.get(domain) || 0) + 1;
    this.domainFailures.set(domain, failures);
    console.log(`[Worker] Recorded failure for ${domain} (total: ${failures})`);
  }
  
  private isCircuitBroken(domain: string): boolean {
    const failures = this.domainFailures.get(domain) || 0;
    const broken = failures >= this.maxFailuresBeforeCircuitBreak;
    if (broken) {
      console.log(`[Worker] Circuit breaker open for ${domain} (failures: ${failures})`);
    }
    return broken;
  }
} 