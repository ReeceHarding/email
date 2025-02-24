# Email Outreach Automation

A web app for automating email outreach by scraping business information, personalizing with AI, and sending through Gmail.

## Key Features

- **Robust SSE Logging**: All console logs (info, warn, error) are forwarded to the browser's SSE endpoint. Let's you see real-time logs in the "Real-time Progress & Logs" box on the lead finder page.
- **Customizable Scraping**: Search and scrape websites. 
- **AI-Driven**: GPT/Claude-based email drafting. 
- **Stripe Integration** for payments
- **Supabase** for user management (optionally).
- **Next.js** for the front end, **Drizzle** for DB.

## Getting Started

1. **Clone the Repo & Install**:
   ```bash
   git clone ...
   cd email-outreach-automation
   npm install
   ```

2. **Environment Setup**:
   - Copy `.env.example` to `.env.local`
   - Fill in required environment variables
   - Make sure to set `BRAVE_API_KEY` for search functionality

3. **Database Setup**:
   - Make sure Postgres is running
   - Run migrations: `npm run db:migrate`
   - Seed data (optional): `npm run db:seed`

4. **Development**:
   ```bash
   npm run dev
   ```

## Debugging & Logging

The app uses Server-Sent Events (SSE) for real-time logging and progress updates. All logs are automatically forwarded to the browser.

### SSE Logging

1. **Console Logs**: All `console.*` calls are automatically forwarded to SSE clients:
   - `console.log()` -> "log" event
   - `console.warn()` -> "warn" event
   - `console.error()` -> "error" event

2. **Log Format**:
   ```typescript
   interface LogEvent {
     timestamp: number;
     level: "log" | "warn" | "error";
     message: string;
   }
   ```

3. **Viewing Logs**:
   - Open browser dev tools
   - Go to "Network" tab
   - Filter by "EventSource"
   - Click on `/api/search/scrape-stream` to see SSE events
   - Or view logs in the "Real-time Progress & Logs" box on the lead finder page

### Common Issues

1. **No Logs Appearing**:
   - Check if SSE connection is established (Network tab)
   - Verify `logStream.startPatching()` is called
   - Check for console errors in browser dev tools

2. **Drizzle Query Errors**:
   - Use standard chain query syntax: 
     ```typescript
     const [user] = await db
       .select()
       .from(usersTable)
       .where(eq(usersTable.clerkId, userClerkId))
       .limit(1)
     ```
   - Avoid using `.query.[tablename].findFirst()`

3. **SSE Connection Issues**:
   - Check CORS settings in Next.js config
   - Verify proper headers are set:
     ```typescript
     headers: {
       "Content-Type": "text/event-stream",
       "Cache-Control": "no-cache, no-transform",
       "Connection": "keep-alive",
       "X-Accel-Buffering": "no"
     }
     ```

## Contributing

1. Create a feature branch
2. Make changes
3. Add tests
4. Submit PR

## License

MIT


