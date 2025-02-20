import { Redis } from 'ioredis';
import { v4 as uuid } from 'uuid';

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

export class ScrapeQueue {
  private redis: Redis;
  
  constructor() {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    this.redis = new Redis(process.env.REDIS_URL);
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
    
    // Save the job in Redis
    await this.redis.set(`job:${jobId}`, JSON.stringify(job));
    // Push its ID onto the queue list
    await this.redis.lpush('scrape:queue', jobId);
    
    return jobId;
  }
  
  async getNextJobId(): Promise<string | null> {
    const result = await this.redis.brpop('scrape:queue', 0);
    if (!result) return null;
    // result is [listName, poppedValue]
    return result[1];
  }
  
  async getJob(jobId: string): Promise<ScrapeJob | null> {
    const data = await this.redis.get(`job:${jobId}`);
    if (!data) return null;
    
    const job = JSON.parse(data);
    // Convert date strings back to Date objects
    job.startedAt = new Date(job.startedAt);
    if (job.completedAt) {
      job.completedAt = new Date(job.completedAt);
    }
    return job;
  }
  
  async updateJob(jobId: string, partial: Partial<ScrapeJob>) {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    const updated = { ...job, ...partial };
    await this.redis.set(`job:${jobId}`, JSON.stringify(updated));
  }
  
  async failJob(jobId: string, error: string) {
    await this.updateJob(jobId, {
      status: 'failed',
      error,
      completedAt: new Date()
    });
  }
  
  async completeJob(jobId: string) {
    await this.updateJob(jobId, {
      status: 'completed',
      completedAt: new Date()
    });
  }
  
  async addUrlToJob(jobId: string, url: string) {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    if (!job.pagesQueued.includes(url)) {
      await this.updateJob(jobId, {
        pagesQueued: [...job.pagesQueued, url]
      });
    }
  }
  
  async incrementPagesScraped(jobId: string) {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    await this.updateJob(jobId, {
      pagesScraped: job.pagesScraped + 1
    });
  }
  
  async getJobStatus(jobId: string): Promise<{
    status: ScrapeJob['status'];
    pagesScraped: number;
    totalQueued: number;
    error?: string;
  } | null> {
    const job = await this.getJob(jobId);
    if (!job) return null;
    
    return {
      status: job.status,
      pagesScraped: job.pagesScraped,
      totalQueued: job.pagesQueued.length,
      error: job.error
    };
  }
  
  async cleanup(jobId: string) {
    await this.redis.del(`job:${jobId}`);
  }
  
  async disconnect() {
    await this.redis.quit();
  }
} 