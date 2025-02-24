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

# Gmail OAuth Integration

This application uses Google OAuth for Gmail integration to send emails. It has been updated to use a custom authentication system instead of Clerk.

## How to Use

1. Set up your environment variables in `.env.local`:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_OAUTH_REDIRECT=http://localhost:3000/api/email-gmail/oauth-callback
   DATABASE_URL=your-database-url
   ```

2. Run the migration to update your database schema:
   ```
   npm run migrate:from-clerk
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. In development mode, a test user is automatically created with:
   - Email: test@example.com
   - User ID: test_user_123

5. Access the application at http://localhost:3000

## Gmail OAuth Flow

1. The user clicks "Connect Gmail" button
2. The application redirects to the Gmail OAuth URL
3. The user authorizes the application
4. Google redirects back to the callback URL with an authorization code
5. The application exchanges the code for access and refresh tokens
6. The tokens are stored in the database
7. The user can now send emails using their Gmail account

## Files Overview

- `lib/auth.ts` - Custom authentication system
- `lib/gmail.ts` - Gmail integration functions
- `actions/gmail-actions.ts` - Server actions for Gmail integration
- `app/api/email-gmail/route.ts` - Gmail OAuth initiation endpoint
- `app/api/email-gmail/oauth-callback/route.ts` - Gmail OAuth callback endpoint
- `components/gmail-connect.tsx` - UI component for connecting Gmail

## Testing

You can run the Gmail integration tests:

```
npm run test:gmail
```

## Migrating from Clerk

If you're migrating from Clerk to the custom auth system:

1. Run the migration script:
   ```
   npm run migrate:from-clerk
   ```

2. This script will:
   - Add a new `user_id` column
   - Copy values from `clerk_id` to `user_id`
   - Add a `session_token` column
   - Add constraints to ensure data integrity
   - Leave the original `clerk_id` column for reference

3. After verifying everything works, you can remove the Clerk package:
   ```
   npm uninstall @clerk/nextjs
   ```


