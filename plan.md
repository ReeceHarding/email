# Plan for Enhanced Dynamic Scraping System

## 1. Current Limitations
- Limited to ~10 pages per domain
- No prioritization of page types
- Basic URL filtering
- No handling of rate limiting or failures
- No queue system for large-scale scraping

## 2. Proposed Enhancements

### A. Improved Page Discovery
```typescript
interface PagePriority {
  url: string;
  type: 'about' | 'team' | 'contact' | 'product' | 'blog' | 'other';
  priority: number; // 1-10
  depth: number;
}

interface ScrapingConfig {
  maxPages: number;
  maxDepth: number;
  priorityThreshold: number;
  allowedDomains: string[];
  excludePatterns: RegExp[];
  rateLimit: number; // requests per second
  timeout: number;
}
```

### B. Queue System
1. Create a Redis-backed queue for managing scraping jobs:
```typescript
interface ScrapeJob {
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
1. Prioritize pages based on:
   - URL patterns (/about, /team, /contact)
   - Meta tags and content relevance
   - Internal link count
   - Page depth from root
2. Use ML/heuristics to identify high-value pages

### D. Robust Error Handling & Retries
1. Implement exponential backoff
2. Handle common failure scenarios:
   - Rate limiting
   - Timeouts
   - Invalid HTML
   - JavaScript-heavy pages
3. Circuit breaker pattern for failing domains

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
  
  // Extract all links
  const links = extractLinks(html);
  
  for (const link of links) {
    const url = normalizeUrl(link, baseUrl);
    
    // Skip if already seen or doesn't match config
    if (seen.has(url) || !shouldProcessUrl(url, config)) continue;
    seen.add(url);
    
    // Determine page type and priority
    const type = determinePageType(url);
    const priority = calculatePriority(url, type);
    const depth = calculateDepth(url, baseUrl);
    
    if (priority >= config.priorityThreshold) {
      pages.push({ url, type, priority, depth });
    }
  }
  
  // Sort by priority
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
    
    await this.redis.set(`job:${jobId}`, JSON.stringify(job));
    await this.redis.lpush('scrape:queue', jobId);
    
    return jobId;
  }
  
  async processJobs() {
    while (true) {
      const jobId = await this.redis.brpop('scrape:queue', 0);
      if (!jobId) continue;
      
      const job = await this.getJob(jobId[1]);
      if (!job) continue;
      
      try {
        await this.processJob(job);
      } catch (error) {
        await this.handleJobError(job, error);
      }
    }
  }
}
```

### Step 3: Scraping Worker
```typescript
// lib/scraping/worker.ts
export class ScrapeWorker {
  private config: ScrapingConfig;
  private queue: ScrapeQueue;
  
  async processUrl(url: string, job: ScrapeJob) {
    // Rate limiting
    await this.rateLimit();
    
    try {
      // Fetch and scrape the page
      const response = await firecrawl.scrapeUrl(url);
      const html = response.html;
      
      // Extract business data
      const data = extractFromHtml(html);
      
      // Find more pages to scrape
      const pages = await findPagesToScrape(html, url, this.config);
      
      // Update job with new pages
      await this.queue.updateJob(job.id, {
        pagesScraped: job.pagesScraped + 1,
        pagesQueued: [...job.pagesQueued, ...pages.map(p => p.url)]
      });
      
      // Store the scraped data
      await this.storeData(job.userId, url, data);
      
      // Queue next pages if within limits
      if (job.pagesScraped < this.config.maxPages) {
        for (const page of pages) {
          if (page.depth <= this.config.maxDepth) {
            await this.queue.addUrl(job.id, page.url);
          }
        }
      }
    } catch (error) {
      await this.handleError(job, url, error);
    }
  }
}
```

### Step 4: Data Storage & Aggregation
```typescript
// lib/scraping/storage.ts
export class ScrapeStorage {
  async storePageData(
    userId: string,
    url: string,
    data: ScrapedBusinessData
  ) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Store page-specific data
      await client.query(
        `INSERT INTO scraped_pages (
          user_id, url, raw_data, processed_data
        ) VALUES ($1, $2, $3, $4)`,
        [userId, url, JSON.stringify(data), JSON.stringify(this.processData(data))]
      );
      
      // Update aggregate lead data
      await this.updateLeadData(client, userId, url, data);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  private processData(data: ScrapedBusinessData) {
    // Clean and normalize data
    return {
      ...data,
      emails: this.normalizeEmails(data.allEmails || []),
      phones: this.normalizePhones(data.phoneNumber ? [data.phoneNumber] : [])
    };
  }
}
```

### Step 5: API Endpoints
```typescript
// app/api/scrape/route.ts
export async function POST(req: Request) {
  const { userId, url } = await req.json();
  
  // Validate input
  if (!isValidUrl(url)) {
    return new Response('Invalid URL', { status: 400 });
  }
  
  // Create scraping job
  const queue = new ScrapeQueue();
  const jobId = await queue.addJob(userId, url);
  
  return new Response(JSON.stringify({ jobId }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' }
  });
}

// app/api/scrape/[jobId]/status/route.ts
export async function GET(
  req: Request,
  { params }: { params: { jobId: string } }
) {
  const queue = new ScrapeQueue();
  const status = await queue.getJobStatus(params.jobId);
  
  return new Response(JSON.stringify(status), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## 4. Monitoring & Analytics

```typescript
// lib/monitoring/scrape-metrics.ts
export class ScrapeMetrics {
  async trackScrapeJob(job: ScrapeJob) {
    // Track in PostHog
    posthog.capture('scrape_job_completed', {
      jobId: job.id,
      userId: job.userId,
      pagesScraped: job.pagesScraped,
      duration: job.completedAt 
        ? job.completedAt.getTime() - job.startedAt.getTime()
        : null,
      success: job.status === 'completed'
    });
    
    // Store metrics in DB
    await this.storeMetrics(job);
  }
}
```

## 5. Usage Example

```typescript
// Example usage in a Next.js API route
export async function POST(req: Request) {
  const { userId, url } = await req.json();
  
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
  
  const queue = new ScrapeQueue();
  const jobId = await queue.addJob(userId, url, config);
  
  // Start worker if not already running
  new ScrapeWorker(config, queue).start();
  
  return new Response(JSON.stringify({ jobId }));
}
```

## 6. Next Steps

1. **Database Schema Updates**
   - Add tables for storing page-level data
   - Add indices for efficient querying
   - Add job tracking tables

2. **Infrastructure Setup**
   - Set up Redis for job queue
   - Configure worker processes
   - Set up monitoring

3. **Testing**
   - Unit tests for each component
   - Integration tests for the full flow
   - Load testing with many concurrent jobs

4. **Documentation**
   - API documentation
   - Configuration guide
   - Deployment instructions 