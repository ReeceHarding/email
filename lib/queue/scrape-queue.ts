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
    console.log('[ScrapeQueue] addJob called:', { userId, baseUrl });
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
    
    console.log('[ScrapeQueue] Storing job in Redis:', job);
    await this.redis.set(`job:${jobId}`, JSON.stringify(job));
    await this.redis.lpush('scrape:queue', jobId);
    
    return jobId;
  }
  
  async getNextJobId(): Promise<string | null> {
    console.log('[ScrapeQueue] Waiting for next job ID...');
    const result = await this.redis.brpop('scrape:queue', 0);
    if (!result) {
      console.log('[ScrapeQueue] No job retrieved, result is null.');
      return null;
    }
    console.log('[ScrapeQueue] Received job ID from list:', result[1]);
    return result[1];
  }
  
  async getJob(jobId: string): Promise<ScrapeJob | null> {
    console.log('[ScrapeQueue] getJob called for jobId:', jobId);
    const data = await this.redis.get(`job:${jobId}`);
    if (!data) {
      console.log('[ScrapeQueue] No job data found in Redis for jobId:', jobId);
      return null;
    }
    const job = JSON.parse(data) as ScrapeJob;
    if (job.startedAt) {
      job.startedAt = new Date(job.startedAt);
    }
    if (job.completedAt) {
      job.completedAt = new Date(job.completedAt);
    }
    return job;
  }
  
  async updateJob(jobId: string, partial: Partial<ScrapeJob>) {
    console.log('[ScrapeQueue] updateJob called for jobId:', jobId, 'with partial:', partial);
    const job = await this.getJob(jobId);
    if (!job) {
      console.log('[ScrapeQueue] Job not found in updateJob:', jobId);
      throw new Error(`Job ${jobId} not found`);
    }
    
    const updated = { ...job, ...partial };
    await this.redis.set(`job:${jobId}`, JSON.stringify(updated));
    console.log('[ScrapeQueue] Job updated:', updated);
  }
  
  async failJob(jobId: string, error: string) {
    console.log('[ScrapeQueue] failJob called for jobId:', jobId, 'error:', error);
    await this.updateJob(jobId, {
      status: 'failed',
      error,
      completedAt: new Date()
    });
  }
  
  async completeJob(jobId: string) {
    console.log('[ScrapeQueue] completeJob called for jobId:', jobId);
    await this.updateJob(jobId, {
      status: 'completed',
      completedAt: new Date()
    });
  }
  
  async addUrlToJob(jobId: string, url: string) {
    console.log('[ScrapeQueue] addUrlToJob called for jobId:', jobId, 'url:', url);
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    if (!job.pagesQueued.includes(url)) {
      job.pagesQueued.push(url);
      await this.updateJob(jobId, {
        pagesQueued: job.pagesQueued
      });
    }
  }
  
  async incrementPagesScraped(jobId: string) {
    console.log('[ScrapeQueue] incrementPagesScraped called for jobId:', jobId);
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    const newCount = job.pagesScraped + 1;
    await this.updateJob(jobId, {
      pagesScraped: newCount
    });
  }
  
  async getJobStatus(jobId: string): Promise<{
    status: ScrapeJob['status'];
    pagesScraped: number;
    totalQueued: number;
    error?: string;
  } | null> {
    console.log('[ScrapeQueue] getJobStatus called for jobId:', jobId);
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
    console.log('[ScrapeQueue] cleanup called for jobId:', jobId);
    await this.redis.del(`job:${jobId}`);
  }
  
  async disconnect() {
    console.log('[ScrapeQueue] disconnecting redis...');
    await this.redis.quit();
  }
} 