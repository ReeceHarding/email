import posthog from 'posthog-js';
import { ScrapeJob } from '../queue/scrape-queue';
import { pool } from '../../db/client';

export class ScrapeMetrics {
  async trackScrapeJob(job: ScrapeJob) {
    try {
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
    } catch (error) {
      console.error('Error tracking scrape job:', error);
    }
  }
  
  private async storeMetrics(job: ScrapeJob) {
    const client = await pool.connect();
    
    try {
      await client.query(
        `INSERT INTO scrape_metrics (
          job_id,
          user_id,
          base_url,
          pages_scraped,
          duration_ms,
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          job.id,
          job.userId,
          job.baseUrl,
          job.pagesScraped,
          job.completedAt ? job.completedAt.getTime() - job.startedAt.getTime() : null,
          job.status
        ]
      );
    } catch (error) {
      console.error('Error storing scrape metrics:', error);
    } finally {
      client.release();
    }
  }
  
  async getJobMetrics(jobId: string) {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM scrape_metrics WHERE job_id = $1',
        [jobId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting job metrics:', error);
      return null;
    } finally {
      client.release();
    }
  }
  
  async getUserMetrics(userId: string) {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        `SELECT 
          COUNT(*) as total_jobs,
          SUM(pages_scraped) as total_pages,
          AVG(duration_ms) as avg_duration,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_jobs
        FROM scrape_metrics 
        WHERE user_id = $1`,
        [userId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting user metrics:', error);
      return null;
    } finally {
      client.release();
    }
  }
} 