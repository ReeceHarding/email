# Email Outreach Automation

A web application for automating email outreach by scraping business information and managing leads.

## Features

- **Dynamic Web Scraping**: Automatically discover and scrape multiple pages within a domain
- **Lead Management**: Store and organize business information
- **Email Automation**: Generate and send personalized emails
- **Analytics**: Track scraping and outreach performance

## Tech Stack  

- Frontend: Next.js, Tailwind, Shadcn
- Backend: Postgres, Supabase, Drizzle ORM, Server Actions
- Auth: Clerk
- Payments: Stripe
- Analytics: PostHog
- Deployment: Vercel
- Queue: Redis

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Fill in required values

4. Start Redis:
   ```bash
   # Install Redis if not already installed
   brew install redis
   
   # Start Redis server
   brew services start redis
   ```

5. Set up the database:
   ```bash
   # Create database
   createdb gmail
   
   # Run migrations
   npm run migrate:push
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

## Enhanced Scraping System

The application includes a dynamic scraping system that can discover and scrape multiple pages within a domain. Key features include:

### Page Discovery
- Automatically finds internal links
- Prioritizes important pages (about, team, contact)
- Filters out irrelevant content
- Respects depth and page limits

### Queue-Based Architecture
- Uses Redis for job management
- Supports concurrent processing
- Handles retries and failures
- Rate limiting to avoid overloading sites

### Data Storage
- Stores raw and processed data
- Maintains scraping metrics
- Aggregates business information
- Tracks job progress

### Configuration
The scraping system can be configured via `ScrapingConfig`:
```typescript
interface ScrapingConfig {
  maxPages: number;      // Maximum pages to scrape
  maxDepth: number;      // Maximum link depth
  priorityThreshold: number; // Minimum priority to scrape (1-10)
  allowedDomains: string[]; // Domains to scrape
  excludePatterns: RegExp[]; // URLs to skip
  rateLimit: number;    // Requests per second
  timeout: number;      // Request timeout in ms
}
```

### Usage

1. Start a scraping job:
```typescript
const queue = new ScrapeQueue();
const jobId = await queue.addJob(userId, url);
```

2. Monitor progress:
```typescript
const status = await queue.getJobStatus(jobId);
console.log(status);
```

3. Run the test script:
```bash
npm run test:scrape [url]
```

## Project Structure

- `actions` - Server actions
  - `db` - Database related actions
- `app` - Next.js app router
  - `api` - API routes
- `components` - Shared components
- `db` - Database
  - `schema` - Database schemas
  - `migrations` - Database migrations
- `lib` - Library code
  - `scraping` - Scraping system
  - `queue` - Job queue
  - `monitoring` - Metrics and analytics

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT


