"use server"

import { ScrapeQueue } from '@/lib/queue/scrape-queue';

export async function GET(
  req: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const queue = new ScrapeQueue();
    const status = await queue.getJobStatus(params.jobId);
    
    if (!status) {
      return new Response('Job not found', { status: 404 });
    }
    
    return new Response(JSON.stringify(status), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting job status:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 