# Plan for Enhanced Dynamic Scraping System

Below is a detailed plan for implementing a dynamic web scraping system that can discover internal links and scrape hundreds or thousands of pages within a domain using Firecrawl. The solution addresses:

- **Dynamic Page Discovery & Prioritization**
- **Queue-based Job Management**
- **Worker Processes**
- **Rate Limiting & Error Handling**
- **Data Storage & Aggregation**
- **Monitoring & Analytics**

---

## 1. Current Limitations

1. Limited to ~10 pages or a single page per domain.
2. No prioritization mechanism (e.g., contact pages first).
3. Basic or no URL filtering — risk of scraping irrelevant or external links.
4. No specialized handling of rate limiting or partial failures.
5. No background queue for large-scale or concurrent scrapes, leading to timeouts.

## 2. Proposed Enhancements

### A. **Improved Page Discovery**

You need to parse each page's HTML for internal links, filter out duplicates or irrelevant paths, and compute a *priority* for each link. This can be done via a function like `findPagesToScrape`, which returns a list of `PagePriority` objects:

```typescript
export interface PagePriority {
  url: string;
  type: 'about' | 'team' | 'contact' | 'product' | 'blog' | 'other';
  priority: number; // e.g. 1-10
  depth: number;
}

export interface ScrapingConfig {
  maxPages: number;
  maxDepth: number;
  priorityThreshold: number;
  allowedDomains: string[];
  excludePatterns: RegExp[];
  rateLimit: number; // requests/second
  timeout: number;   // request timeout in ms
}
```

A function can scan for anchor tags, transform relative to absolute URLs, filter out external or disallowed patterns, and assign a priority (e.g., contact pages get higher priority).

### B. Queue System

A Redis-based queue can let you enqueue URLs to scrape. This approach provides:
1. Scalability: Multiple workers can process the queue concurrently.
2. Fault Tolerance: If a worker fails, another worker can resume from the queue.
3. Rate Control: You can implement rate limiting logic before dequeuing or processing each item.

You might define a ScrapeJob interface and store it in Redis:

```typescript
export interface ScrapeJob {
  id: string;
  userId: string;
  baseUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  pagesScraped: number;
  pagesQueued: string[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}
```

### C. Intelligent Page Selection
- Heuristics:
  1. If URL matches about, team, contact, or product, increase priority.
  2. Check meta tags or content snippet (if available from Firecrawl) to see if it's likely relevant.
  3. Depth from the starting URL (depth=0 for the root, depth=1 for links on root, etc.). Higher depth could reduce priority.
- Machine Learning (Optional):
  - If you have data about which pages historically yield better info, feed that into a simple classifier or rating function.

### D. Robust Error Handling & Retries
1. Exponential Backoff on Firecrawl failures (network errors, site timeouts).
2. Rate-Limiting: If you set rateLimit = 2 (requests/second), the worker ensures it doesn't exceed that. This can be done via setTimeout or token-bucket algorithms.
3. Circuit Breaker: If a domain fails repeatedly (e.g., 10 consecutive timeouts), mark it as "circuit open" to avoid repeatedly hitting a down site.

## 3. Implementation Steps

### Step 1: Enhanced Page Discovery

```typescript
// lib/scraping/page-discovery.ts

export async function findPagesToScrape(
  html: string, 
  baseUrl: string,
  config: ScrapingConfig
): Promise<PagePriority[]> {
  const pages: PagePriority[] = [];
  const seen = new Set<string>();

  // 1) Extract all links from anchor tags
  const links = extractLinks(html); // a simple function or library

  for (const link of links) {
    const absUrl = normalizeUrl(link, baseUrl);
    
    // Filter out if already seen or doesn't match domain/exclude patterns
    if (seen.has(absUrl) || !shouldProcessUrl(absUrl, config)) continue;
    seen.add(absUrl);

    // Determine type, priority, and depth
    const type = determinePageType(absUrl);
    const priority = calculatePriority(absUrl, type);
    const depth = calculateDepth(absUrl, baseUrl);

    // If above threshold, push to results
    if (priority >= config.priorityThreshold && depth <= config.maxDepth) {
      pages.push({ url: absUrl, type, priority, depth });
    }
  }

  // Sort by priority descending, so high-value pages are processed first
  return pages.sort((a, b) => b.priority - a.priority);
}
```

### Step 2: Queue System Setup

```typescript
// lib/queue/scrape-queue.ts
import { Redis } from 'ioredis';
import { v4 as uuid } from 'uuid';

export class ScrapeQueue {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!); 
  }

  // Create a new job for an entire domain
  async addJob(userId: string, baseUrl: string): Promise<string> {
    const jobId = uuid();
    const job: ScrapeJob = {
      id: jobId,
      userId,
      baseUrl,
      status: 'pending',
      pagesScraped: 0,
      pagesQueued: [baseUrl],
      startedAt: new Date()
    };

    // Save the job in Redis
    await this.redis.set(`job:${jobId}`, JSON.stringify(job));
    // Push its ID onto the queue list
    await this.redis.lpush('scrape:queue', jobId);

    return jobId;
  }

  // A worker might block-pop from "scrape:queue" to get job IDs
  async getNextJobId(): Promise<string | null> {
    const result = await this.redis.brpop('scrape:queue', 0);
    if (!result) return null;
    // result is [listName, poppedValue]
    return result[1];
  }

  // Retrieve job object
  async getJob(jobId: string): Promise<ScrapeJob | null> {
    const data = await this.redis.get(`job:${jobId}`);
    return data ? JSON.parse(data) : null;
  }

  // Update job in Redis
  async updateJob(jobId: string, partial: Partial<ScrapeJob>) {
    const job = await this.getJob(jobId);
    if (!job) return;
    const updated = { ...job, ...partial };
    await this.redis.set(`job:${jobId}`, JSON.stringify(updated));
  }
}
```

### Step 3: Scraping Worker

```typescript
// lib/scraping/worker.ts
import { ScrapeQueue, ScrapeJob } from '@/lib/queue/scrape-queue';
import { findPagesToScrape } from './page-discovery';
import { scrapeWebsite } from '@/lib/firecrawl'; // your Firecrawl wrapper

export class ScrapeWorker {
  private config: ScrapingConfig;
  private queue: ScrapeQueue;
  private lastRequestTime = 0;

  constructor(config: ScrapingConfig, queue: ScrapeQueue) {
    this.config = config;
    this.queue = queue;
  }

  // This method runs continuously, pulling from the queue
  async start() {
    console.log('ScrapeWorker started');
    while (true) {
      const jobId = await this.queue.getNextJobId();
      if (!jobId) {
        // No jobs in queue, worker can idle for a bit or exit
        await new Promise(res => setTimeout(res, 2000));
        continue;
      }
      // We have a job to process
      const job = await this.queue.getJob(jobId);
      if (!job) continue;

      try {
        await this.processJob(job);
      } catch (err) {
        console.error('Failed to process job:', err);
      }
    }
  }

  private async processJob(job: ScrapeJob) {
    // Mark as processing
    await this.queue.updateJob(job.id, { status: 'processing' });

    // While we have queued pages
    let pagesToProcess = job.pagesQueued;
    while (pagesToProcess.length > 0 && job.pagesScraped < this.config.maxPages) {
      // Take the first page
      const url = pagesToProcess.shift()!;
      // Scrape it
      await this.scrapeAndDiscover(job, url);

      // Re-fetch job from Redis to get the updated state (pagesScraped, pagesQueued)
      const updatedJob = await this.queue.getJob(job.id);
      if (!updatedJob) return;
      job = updatedJob;
      pagesToProcess = job.pagesQueued;
    }

    // Job done or maxPages reached
    await this.queue.updateJob(job.id, {
      status: 'completed',
      completedAt: new Date()
    });
    console.log(`Job ${job.id} completed, pagesScraped=${job.pagesScraped}`);
  }

  private async scrapeAndDiscover(job: ScrapeJob, url: string) {
    try {
      // Rate-limit before making the request
      await this.rateLimit();

      // Use your Firecrawl function
      const result = await scrapeWebsite(url, { 
        retries: 3, 
        maxDepth: 1 // not used in Firecrawl, but optional
      });

      // We get `result.html` and `result.businessData`
      const html = result.html || '';
      const data = result.businessData || {};

      // Store data in DB
      await this.storePageData(job.userId, url, data);

      // Parse and queue child links
      const discoveredPages = await findPagesToScrape(html, url, this.config);
      // Insert them into pagesQueued
      const newUrls = discoveredPages
        .map(p => p.url)
        .filter(u => !job.pagesQueued.includes(u)); // skip duplicates

      // Update job in Redis
      await this.queue.updateJob(job.id, {
        pagesScraped: job.pagesScraped + 1,
        pagesQueued: [...job.pagesQueued, ...newUrls]
      });
    } catch (error: any) {
      console.error(`Error scraping ${url}:`, error.message || error);
    }
  }

  private async storePageData(userId: string, url: string, data: any) {
    // You can replicate your existing logic from "actions/db/leads-actions.ts"
    // or store in a new table "scraped_pages".
    // For example:
    // const storage = new ScrapeStorage();
    // await storage.storePageData(userId, url, data);

    console.log(`Storing page data for ${url}`);
  }

  private async rateLimit() {
    if (this.config.rateLimit <= 0) return;

    const minIntervalMs = 1000 / this.config.rateLimit;
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < minIntervalMs) {
      await new Promise(res => setTimeout(res, minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}
```

### Step 4: Data Storage & Aggregation

You likely have a leads table for single-page data. For multi-page, consider an additional table scraped_pages:

```sql
CREATE TABLE IF NOT EXISTS scraped_pages (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  raw_data JSONB,
  processed_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

Then in your code:

```typescript
// lib/scraping/storage.ts
import { pool } from '@/db/client'; // or your drizzle instance

export class ScrapeStorage {
  async storePageData(
    userId: string,
    url: string,
    data: Record<string, any>
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO scraped_pages (user_id, url, raw_data, processed_data)
         VALUES ($1, $2, $3, $4)`,
        [userId, url, JSON.stringify(data), JSON.stringify(this.processData(data))]
      );

      // Optionally update an aggregate leads table if relevant
      await this.updateLeadData(client, userId, url, data);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private processData(data: any) {
    // Clean or standardize data if needed
    return data;
  }

  private async updateLeadData(
    client: any,
    userId: string,
    url: string,
    data: any
  ) {
    // Example: if we want to store discovered contact info in leads
    // upsert into leads based on the domain or some unique key
  }
}
```

### Step 5: API Endpoints

Use Next.js Route Handlers for triggers and status checks. For instance:

```typescript
// app/api/scrape/route.ts
import { ScrapeQueue } from '@/lib/queue/scrape-queue';
import { ScrapeWorker } from '@/lib/scraping/worker';

export async function POST(req: Request) {
  const { userId, url } = await req.json();

  // Validate
  if (!isValidUrl(url)) {
    return new Response('Invalid URL', { status: 400 });
  }

  // Create job
  const queue = new ScrapeQueue();
  const jobId = await queue.addJob(userId, url);

  // For demonstration, start a worker here. In production,
  // you might have a dedicated worker process or cron job that always runs.
  const config = {
    maxPages: 1000,
    maxDepth: 5,
    priorityThreshold: 2,
    allowedDomains: [new URL(url).hostname],
    excludePatterns: [/\.(jpg|jpeg|png|gif|css|js)$/i],
    rateLimit: 2,
    timeout: 30000
  };
  new ScrapeWorker(config, queue).start();

  return new Response(JSON.stringify({ jobId }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' }
  });
}

// app/api/scrape/[jobId]/status/route.ts
import { ScrapeQueue } from '@/lib/queue/scrape-queue';

export async function GET(
  req: Request,
  { params }: { params: { jobId: string } }
) {
  const queue = new ScrapeQueue();
  const job = await queue.getJob(params.jobId);
  if (!job) {
    return new Response('Job not found', { status: 404 });
  }
  return new Response(JSON.stringify(job), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Step 6: Monitoring & Analytics
- Use your existing PostHog integration to track scraping events: `posthog.capture('Scraping Started', {...})`.
- Log worker crashes or domain-level failures for each job.
- Provide a UI in your Next.js dashboard to show each job, how many pages have been scraped, and any errors.

## 4. Conclusion & Next Steps

1. **Implement the DB Schema**: Add a scraped_pages table or similar. Optionally add a scrape_jobs table if you want persistent job data beyond Redis.
2. **Configure Redis**: Ensure you have a Redis instance for the queue. Set the REDIS_URL env variable in your deployment environment.
3. **Set Up Workers**: Decide how to run the ScrapeWorker. You may spin up a separate Node.js process or container specifically for queue processing. For serverless platforms, you may handle short bursts, but large-scale scraping can risk timeouts—so consider using background job capabilities from providers like AWS Lambda with event bridging or a container service.
4. **Refine Heuristics**: Tweak the priorityThreshold, maxDepth, and pattern matching as you gather real usage data.
5. **Error Handling & Retries**: Expand on exponential backoff logic, domain-based circuit breaker, and partial success outcomes.

By integrating this plan, your system will dynamically discover internal links, scrape them at scale using Firecrawl, manage concurrency, store structured data, and handle real-world complexities like failing or slow sites, all while letting you easily track job progress and performance. 