import 'dotenv/config';
import { ScrapeQueue } from './queue/scrape-queue';
import { ScrapeWorker } from './scraping/worker';
import { ScrapingConfig } from './scraping/page-discovery';
import { ScrapeMetrics } from './monitoring/scrape-metrics';

const TEST_USER_ID = 'test-user-123';
const TEST_URL = process.argv[2] || 'https://about.google';
const MAX_TEST_DURATION = 600000; // 10 minutes

async function testScrapeSystem() {
  console.log('\nTesting Enhanced Scraping System');
  console.log('='.repeat(50));
  
  let worker: ScrapeWorker | undefined;
  let queue: ScrapeQueue | undefined;
  
  try {
    // 1. Initialize components
    console.log('\nInitializing components...');
    queue = new ScrapeQueue();
    const metrics = new ScrapeMetrics();
    
    const config: ScrapingConfig = {
      maxPages: 5, // Limit to most important pages
      maxDepth: 2,
      priorityThreshold: 7, // Only scrape high-priority pages (about, team, contact)
      allowedDomains: [new URL(TEST_URL).hostname.replace(/^www\./, '')],
      excludePatterns: [
        // Skip common file extensions
        /\.(jpg|jpeg|png|gif|css|js|xml|txt|pdf|zip|rar|gz|tar|dmg|exe|apk|ipa)$/i,
        // Skip common non-content paths
        /\/(tag|category|author|search|archive|feed|rss|sitemap|wp-|node_modules)\//i,
        // Skip common tracking/utility paths
        /\/(track|click|analytics|pixel|beacon|stat|log|metrics|utm_|ref_|affiliate)\//i,
        // Skip common dynamic/utility parameters
        /\?(utm_|ref_|affiliate|sid|session|token|auth|redirect)/i,
        // Skip menu and product pages
        /\/(menu|product|item|category|collection)\//i
      ],
      rateLimit: 1, // 1 request per second to be more polite
      timeout: 60000 // 60 seconds per request
    };
    
    // 2. Create job
    console.log('\nCreating scrape job...');
    const jobId = await queue.addJob(TEST_USER_ID, TEST_URL);
    console.log('Job created:', jobId);
    
    // 3. Start worker
    console.log('\nStarting worker...');
    worker = new ScrapeWorker(config, queue);
    worker.start().catch(error => {
      console.error('Worker error:', error);
    });
    
    // 4. Monitor progress
    let completed = false;
    const startTime = Date.now();
    let lastStatus = '';
    
    while (!completed && (Date.now() - startTime) < MAX_TEST_DURATION) {
      const status = await queue.getJobStatus(jobId);
      if (!status) {
        throw new Error('Job not found');
      }
      
      const statusStr = JSON.stringify(status);
      if (statusStr !== lastStatus) {
        console.log('\nJob Status:', status);
        lastStatus = statusStr;
      }
      
      if (status.status === 'completed' || status.status === 'failed') {
        completed = true;
        break;
      }
      
      await new Promise(res => setTimeout(res, 2000)); // Check every 2 seconds
    }
    
    // 5. Get final metrics
    const jobMetrics = await metrics.getJobMetrics(jobId);
    console.log('\nFinal Metrics:', jobMetrics);
    
    // 6. Cleanup
    console.log('\nCleaning up...');
    if (worker) {
      await worker.stop();
    }
    if (queue) {
      await queue.cleanup(jobId);
      await queue.disconnect();
    }
    
    if (!completed) {
      console.log('\nTest timed out');
      process.exit(1);
    }
    
    console.log('\nTest completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('\nTest failed:', error);
    
    // Cleanup on error
    if (worker) {
      await worker.stop();
    }
    if (queue) {
      await queue.disconnect();
    }
    
    process.exit(1);
  }
}

// Run the test
testScrapeSystem().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
}); 