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
    console.log("[ScrapeWorker] Constructed with config:", config);
  }
  
  async start() {
    if (this.isRunning) {
      console.log("[ScrapeWorker] Already running, ignoring start call.");
      return;
    }
    this.isRunning = true;
    console.log("[ScrapeWorker] Started main loop...");
    
    try {
      while (this.isRunning) {
        console.log("[ScrapeWorker] Attempting to get next job ID from queue...");
        const jobId = await this.queue.getNextJobId();
        if (!jobId) {
          console.log("[ScrapeWorker] No job ID found, sleeping...");
          await new Promise((res) => setTimeout(res, 2000));
          continue;
        }
        
        console.log("[ScrapeWorker] Fetched job ID:", jobId, " -> retrieving job details...");
        const job = await this.queue.getJob(jobId);
        if (!job) {
          console.log("[ScrapeWorker] Could not find job data in Redis for jobId=", jobId);
          continue;
        }
        
        try {
          console.log(`[ScrapeWorker] Processing job ${job.id} with baseUrl=${job.baseUrl}`);
          await this.processJob(job);
        } catch (error) {
          console.error("[ScrapeWorker] processJob error:", error);
          await this.queue.failJob(jobId, error instanceof Error ? error.message : "Unknown error");
        }
      }
    } catch (error) {
      console.error("[ScrapeWorker] Fatal error in main loop:", error);
      this.isRunning = false;
      throw error;
    }
  }
  
  async stop() {
    console.log("[ScrapeWorker] Stopping the worker...");
    this.isRunning = false;
  }
  
  private async processJob(job: ScrapeJob) {
    console.log(`[ScrapeWorker] Setting job ${job.id} to 'processing'`);
    await this.queue.updateJob(job.id, { status: "processing" });
    this.processedUrls.clear();
    
    try {
      console.log("[ScrapeWorker] Starting with baseUrl for job:", job.baseUrl);
      await this.scrapeAndDiscover(job, job.baseUrl);
      
      while (job.pagesQueued.length > 0 && job.pagesScraped < this.config.maxPages) {
        const url = job.pagesQueued.shift()!;
        if (!this.processedUrls.has(url)) {
          await this.scrapeAndDiscover(job, url);
        }
        
        const updatedJob = await this.queue.getJob(job.id);
        if (!updatedJob) {
          console.log(`[ScrapeWorker] Job ${job.id} missing after partial processing`);
          return;
        }
        job = updatedJob;
      }
      
      console.log(`[ScrapeWorker] All pages done or maxPages reached. Marking job ${job.id} complete.`);
      await this.queue.completeJob(job.id);
    } catch (error) {
      console.error(`[ScrapeWorker] Error during job ${job.id}:`, error);
      await this.queue.failJob(job.id, error instanceof Error ? error.message : "Unknown error");
    }
  }
  
  private async scrapeAndDiscover(job: ScrapeJob, url: string) {
    if (this.processedUrls.has(url)) {
      console.log(`[ScrapeWorker] Already processed ${url}, skipping`);
      return;
    }
    
    const domain = new URL(url).hostname;
    console.log(`[ScrapeWorker] Attempting to scrape ${url} (domain=${domain})`);
    
    if (this.isCircuitBroken(domain)) {
      console.log(`[ScrapeWorker] Domain ${domain} circuit is broken, skipping`);
      return;
    }
    
    try {
      await this.rateLimit();
      console.log("[ScrapeWorker] Scraping site with scrapeWebsite, url=", url);
      const result = await this.scrapeWithRetries(url);
      
      if (!result.success || !result.extractedText) {
        throw new Error("[ScrapeWorker] scrapeWithRetries failed or returned no text");
      }
      console.log("[ScrapeWorker] Successfully scraped. Inserting into DB... domainFailures reset");
      this.domainFailures.delete(domain);
      
      console.log("[ScrapeWorker] Storing data for url=", url, " jobId=", job.id);
      await this.storage.storePageData(job.userId, url, result.businessData!, result.extractedText || "");
      
      this.processedUrls.add(url);
      
      console.log("[ScrapeWorker] Finding child pages from result...");
      const discovered = await findPagesToScrape(result.extractedText, url, this.config);
      console.log(`[ScrapeWorker] Found ${discovered.length} new pages from ${url}`);
      
      await this.queue.incrementPagesScraped(job.id);
      
      if (job.pagesScraped < this.config.maxPages) {
        for (const page of discovered) {
          if (page.depth <= this.config.maxDepth && !this.processedUrls.has(page.url)) {
            console.log("[ScrapeWorker] queueing new URL:", page.url, "priority=", page.priority, "depth=", page.depth);
            await this.queue.addUrlToJob(job.id, page.url);
          }
        }
      }
    } catch (error) {
      console.error(`[ScrapeWorker] Error scraping ${url}:`, error);
      this.recordFailure(domain);
    }
  }
  
  private async scrapeWithRetries(url: string, attempt = 0): Promise<Awaited<ReturnType<typeof scrapeWebsite>>> {
    try {
      console.log(`[ScrapeWorker] scrapeWithRetries attempt ${attempt + 1} for URL=${url}`);
      return await scrapeWebsite(url, { maxDepth: 1 });
    } catch (error) {
      if (attempt >= this.retryDelays.length) {
        console.error(`[ScrapeWorker] Max retries reached for ${url}`);
        throw error;
      }
      const delay = this.retryDelays[attempt];
      console.log(`[ScrapeWorker] Retrying in ${delay}ms for ${url}`);
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
      console.log(`[ScrapeWorker] rateLimit waiting ${waitTime}ms`);
      await new Promise(res => setTimeout(res, waitTime));
    }
    this.lastRequestTime = Date.now();
  }
  
  private recordFailure(domain: string) {
    const fails = (this.domainFailures.get(domain) || 0) + 1;
    this.domainFailures.set(domain, fails);
    console.log(`[ScrapeWorker] domain=${domain} recordFailure total=`, fails);
  }
  
  private isCircuitBroken(domain: string): boolean {
    const fails = this.domainFailures.get(domain) || 0;
    const broken = fails >= this.maxFailuresBeforeCircuitBreak;
    if (broken) {
      console.log(`[ScrapeWorker] Circuit breaker open for domain=${domain} fails=${fails}`);
    }
    return broken;
  }
} 