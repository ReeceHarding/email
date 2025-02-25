# Cold Outreach Automation System - Implementation Plan

This document outlines the step-by-step implementation plan for building a complete, autonomous cold outreach system that:
1. Takes user input about their business
2. Automatically generates search queries
3. Scrapes target websites for business and team member information
4. Researches contacts through secondary sources
5. Generates personalized emails
6. Sends emails and manages responses
7. Provides a dashboard to monitor the entire process

## Tech Stack

- Frontend: Next.js, Tailwind, Shadcn, Framer Motion
- Backend: Postgres, Supabase, Drizzle ORM, Server Actions
- Auth: Supabase Auth
- Payments: Stripe
- Analytics: PostHog
- Deployment: Vercel

## Project Structure

- `actions` - Server actions
  - `db` - Database related actions
  - Other actions
- `app` - Next.js app router
  - `api` - API routes
  - `route` - An example route
    - `_components` - One-off components for the route
    - `layout.tsx` - Layout for the route
    - `page.tsx` - Page for the route
- `components` - Shared components
  - `ui` - UI components
  - `utilities` - Utility components
- `db` - Database
  - `schema` - Database schemas
- `lib` - Library code
  - `hooks` - Custom hooks
- `prompts` - Prompt files
- `public` - Static assets
- `types` - Type definitions

## Project Vision

This is an automated cold outreach system designed to help businesses generate leads efficiently. The workflow is:

1. User provides information about their business (e.g., "I run a review automation software for dentists in Dallas Texas")
2. System automatically generates and executes relevant search queries (e.g., "dentists in Dallas Texas")
3. System scrapes discovered websites to extract business information and team members
4. System performs deeper research on individuals to find contact information and personalization points
5. System generates highly personalized outreach emails based on gathered information
6. System sends emails and monitors for responses
7. System can automatically continue conversations based on response content
8. User can oversee and control the entire process through a comprehensive dashboard

## Initial Setup Information

### Current State of Codebase
The project already has several key components partially implemented:

- **Scraping Engine**: A basic version exists in `lib/enhanced-scraper.ts`
- **Search Service**: Available in `lib/search-service.ts` (needs completion)
- **Query Generation**: Started in `lib/query-generation.ts`
- **Email Service**: Foundation in `lib/email-service.ts`
- **Contact Research**: Initial implementation in `lib/contact-research.ts`

### Repository Information
- **Git Repository**: Use the existing git repository at the current working directory
- **Test Directory**: Create tests in the `__tests__` directory
- **Commit Frequently**: Commit after each step is completed and tested

### Environment Requirements
- **Node.js**: Version 18+
- **TypeScript**: Version 5.0+
- **Environment Variables**: Refer to `.env.example` and ensure all required variables are set in `.env.local`
- **API Keys Needed**:
  - Brave Search API
  - OpenAI API
  - Supabase API (authentication and database)
  - Gmail API (for email sending)
  - Stripe API (for payments)
  - PostHog API (for analytics)

### Test Data
Create a `test-data` directory containing:
- Sample business websites to test scraping
- Mock search results
- Test email templates
- Test user profiles

### Dependency Map
This shows which steps have dependencies on previous steps. The AI developer should prioritize steps accordingly.

```
Phase 1 (Core Setup) ───┐
                        ├─→ Phase 2 (Search) ─────┐
                        │                         ├─→ Phase 6 (Workflow) ─────┐
                        │                         │                           │
                        ├─→ Phase 3 (Scraping) ───┘                           ├─→ Phase 8 (Integration)
                        │                                                     │
                        ├─→ Phase 4 (Research) ───┐                           │
                        │                         ├─→ Phase 5 (Email) ────────┘
                        └─→ Phase 7 (Dashboard) ──┘
                        
                                           ↓
                       
                         Phase 9 (AI Enhancement) ─→ Phase 10 (Analytics)
```

**Critical Paths**:
- Step 1-4 (Core Setup) must be completed first
- Steps 24-25 (Workflow) depend on Search (6-8) and Scraping (9-13)
- Integration (35-40) depends on most other components
- AI Enhancement (41-45) should only be started after core functionality works

## Progress Tracking

### Overall Progress
- [x] Phase 1: Environment Setup and Core Infrastructure (4/4 complete)
  - [x] Step 1: Project Structure and Dependencies
  - [x] Step 2: Database Schema Setup
  - [x] Step 3: Auth Integration
  - [x] Step 4: Basic API Routes
- [x] Phase 2: Search and Query Generation (4/4 complete)
  - [x] Step 5: OpenAI Integration
  - [x] Step 6: Query Generation Implementation
  - [x] Step 7: Brave Search API Integration
  - [x] Step 8: Search Results Processing
- [ ] Phase 3: Web Scraping Components (0/5 complete)
- [ ] Phase 4: Contact Research and Enrichment (0/5 complete)
- [ ] Phase 5: Email Generation and Sending (2/5 complete)
  - [x] Step 21: Gmail API Integration
  - [x] Step 22: Email Sending Service
  - [ ] Step 23: Email Response Handling
  - [ ] Step 24: Email Template System
  - [ ] Step 25: Drip Campaign Logic
- [ ] Phase 6: Workflow Orchestration (0/5 complete)
- [ ] Phase 7: Dashboard UI (0/6 complete)
- [ ] Phase 8: Integration and End-to-End Functionality (0/6 complete)
- [ ] Phase 9: AI Enhancement and Advanced Features (0/5 complete)
- [ ] Phase 10: Analytics, Optimization, and Security (0/5 complete)

**Total Progress:** 8/50 steps complete (16%)

## Development Guidelines

- **Testing**: Each step has a checkpoint test to verify functionality
- **Git Commits**: Make a commit after each test passes with a descriptive message
- **Incremental Development**: Build and test components individually before integration
- **Documentation**: Add comments to explain complex logic
- **Error Handling**: Implement robust error handling throughout

## Phase 1: Environment Setup and Core Infrastructure

### Step 1: Project Structure and Dependencies
- [x] **COMPLETE**

**Task**: Set up the basic project structure and install required dependencies.
**Implementation**:
- Initialize the Next.js project with TypeScript
- Install required packages: Puppeteer, Cheerio, OpenAI, Axios, etc.
- Configure environment variables for API keys and secrets
- Set up basic folder structure following the project structure outlined in the tech stack:
  - `actions` - Server actions
  - `app` - Next.js app router
  - `components` - Shared components
  - `db` - Database
  - `lib` - Library code
  - `prompts` - Prompt files
  - `public` - Static assets
  - `types` - Type definitions

**Deliverables**:
- Fully configured Next.js project with TypeScript
- Complete package.json with all required dependencies
- .env.local with all necessary environment variables
- Basic folder structure matching the project structure
- README.md with setup instructions

**Tests**:
1. Test that all required directories exist (implemented in project-structure.test.ts)
2. Test that package.json contains all necessary dependencies (implemented in dependencies.test.ts)
3. Test that the Next.js application can build without errors (implemented in build.test.ts)

**Checkpoint Test**: Verify project builds without errors.
```bash
npm run build
```
**Commit Message**: "Initial project setup with core dependencies"

### Step 2: Database Schema Setup
- [x] **COMPLETE**

**Task**: Create database schema for storing business profiles, leads, and user data.
**Implementation**:
- Define the following schemas using Drizzle ORM:

  1. **Users Table**:
     - `id`: serial primary key
     - `userId`: text, not null, unique
     - `name`: varchar, not null
     - `email`: varchar, not null
     - `sessionToken`: text (for session management)
     - `gmailAccessToken`: varchar
     - `gmailRefreshToken`: varchar
     - `stripeCustomerId`: varchar
     - `stripeSubscriptionId`: varchar
     - `createdAt`: timestamp, default now
     - `updatedAt`: timestamp, default now

  2. **Business Profiles Table**:
     - `id`: uuid primary key
     - `userId`: text, foreign key to users
     - `businessName`: text, not null
     - `websiteUrl`: text, not null, unique
     - `email`: text
     - `phone`: text
     - `address`: text
     - `industry`: text
     - `description`: text
     - `notes`: text
     - `uniqueSellingPoints`: text
     - `outreachStatus`: enum (not_started, in_progress, contacted, responded, converted)
     - `lastScrapedAt`: timestamp
     - `createdAt`: timestamp, default now
     - `updatedAt`: timestamp, default now

  3. **Team Members Table**:
     - `id`: uuid primary key
     - `businessProfileId`: uuid, foreign key to business_profiles
     - `name`: text, not null
     - `role`: text
     - `email`: text
     - `phone`: text
     - `socialProfiles`: jsonb (for LinkedIn, Twitter, etc.)
     - `researchNotes`: text
     - `outreachStatus`: enum (not_started, in_progress, contacted, responded, converted)
     - `createdAt`: timestamp, default now
     - `updatedAt`: timestamp, default now

  4. **Contact Information Table**:
     - `id`: uuid primary key
     - `businessProfileId`: uuid, nullable, foreign key to business_profiles
     - `teamMemberId`: uuid, nullable, foreign key to team_members
     - `type`: enum (email, phone, linkedin, twitter, instagram, other)
     - `value`: text, not null
     - `source`: text (where this was found)
     - `confidenceScore`: float (0-1)
     - `createdAt`: timestamp, default now
     - `updatedAt`: timestamp, default now

  5. **Research Data Table**:
     - `id`: uuid primary key
     - `businessProfileId`: uuid, nullable, foreign key to business_profiles
     - `teamMemberId`: uuid, nullable, foreign key to team_members
     - `category`: enum (personal_info, work_history, interests, education, etc.)
     - `data`: jsonb
     - `source`: text
     - `confidenceScore`: float (0-1)
     - `createdAt`: timestamp, default now
     - `updatedAt`: timestamp, default now

  6. **Email Campaigns Table**:
     - `id`: uuid primary key
     - `userId`: text, foreign key to users
     - `name`: text, not null
     - `description`: text
     - `status`: enum (draft, active, paused, completed)
     - `settings`: jsonb (for campaign settings)
     - `createdAt`: timestamp, default now
     - `updatedAt`: timestamp, default now

  7. **Email Messages Table**:
     - `id`: uuid primary key
     - `campaignId`: uuid, foreign key to email_campaigns
     - `businessProfileId`: uuid, nullable, foreign key to business_profiles
     - `teamMemberId`: uuid, nullable, foreign key to team_members
     - `threadId`: text (Gmail thread ID)
     - `messageId`: text (Gmail message ID)
     - `direction`: enum (outbound, inbound)
     - `subject`: text
     - `body`: text
     - `status`: enum (draft, sent, delivered, opened, replied)
     - `sentAt`: timestamp
     - `createdAt`: timestamp, default now
     - `updatedAt`: timestamp, default now

- Set up proper relations and constraints between tables
- Implement soft delete functionality by adding `deleted: boolean` to relevant tables
- Set up Supabase client and Drizzle ORM configuration

**Deliverables**:
- Complete schema definitions for all tables in separate files
- Proper exports of types for all tables
- Configured Drizzle ORM setup with Supabase
- Updated db/schema/index.ts file exporting all schemas
- All schemas following the required naming conventions and formats

**Tests**:
1. Test that all schema files exist and export correct types
2. Test that schema tables have all required fields with correct types
3. Test that foreign key relationships are properly defined

**Checkpoint Test**: Verify schema creates successfully in test database.
```bash
npm run db:push:test
```
**Commit Message**: "Add database schema for businesses and leads"

### Step 3: Authentication Integration 
- [x] **COMPLETE**

**Task**: Implement user authentication using Clerk.
**Implementation**:
- Set up Clerk account and configure application
- Implement authentication hooks and middleware
- Create protected routes and authentication checks
- Set up authentication-related components (sign-in, sign-up, user profile)
- Manage user session and tokens
- Integrate with the database to store user information

**Deliverables**:
- Complete Clerk integration for authentication
- User session management utilities
- Protected route middleware
- Authentication wrapper components
- User profile management

**Tests**:
1. Test that authentication middleware protects routes correctly
2. Test that user session information is properly stored and retrieved
3. Test sign-in and sign-out functionality

**Checkpoint Test**: Verify protected routes require authentication.
```bash
npm run test:auth
```
**Commit Message**: "Add Clerk authentication integration"

### Step 4: Basic API Routes
- [x] **COMPLETE**

**Task**: Create API route structure for different functions.
**Implementation**:
- Set up the following API routes and server actions:

  1. **User Actions** (`actions/db/users-actions.ts`):
     - `getUserAction`: Get current user data
     - `updateUserAction`: Update user profile
     - `deleteUserAction`: Delete user account

  2. **Business Profile Routes** (`app/api/business-profiles`):
     - GET: Get all business profiles for user
     - POST: Create new business profile
     - GET /[id]: Get specific business profile
     - PUT /[id]: Update business profile
     - DELETE /[id]: Delete business profile

  3. **Team Member Routes** (`app/api/team-members`):
     - GET: Get all team members
     - POST: Create new team member
     - GET /[id]: Get specific team member
     - PUT /[id]: Update team member
     - DELETE /[id]: Delete team member

  4. **Email Routes** (`app/api/emails`):
     - GET: Get all emails
     - POST: Send an email
     - GET /[id]: Get specific email
     - POST /webhook: Handle Gmail webhook events

  5. **Search Routes** (`app/api/search`):
     - POST: Perform search query
     - GET /results: Get search results

  6. **Scraping Routes** (`app/api/scrape`):
     - POST: Start scraping job
     - GET /status/[id]: Get scraping job status
     - GET /results/[id]: Get scraping results

- Implement middleware for authentication and error handling
- Use Next.js app router route handlers
- Set up proper error handling and response formatting

**Deliverables**:
- Complete set of API routes with proper implementations
- Authentication middleware protecting all routes
- Error handling for all routes
- Response formatting for consistent API responses
- Server actions for data mutations
- TypeScript types for all request/response data

**Checkpoint Test**: Verify API routes return expected responses with mock data.
```bash
npm run test:api
```
**Commit Message**: "Set up API route structure with middleware"

### Phase 1 Integration Test
**Task**: Verify all components in Phase 1 work together properly.
**Test Steps**:
1. Start the development server
2. Verify authentication flow with database integration
3. Test API routes with authentication
4. Check environment variables are properly loaded

**Success Criteria**:
- User can sign up, log in, and log out
- Protected routes correctly redirect to login
- API routes return proper responses when authenticated
- API routes return 401 when not authenticated
- Database operations work correctly through API routes

```bash
npm run test:phase1
```
**Commit Message**: "Complete Phase 1: Core Infrastructure"

## Phase 2: Search and Query Generation

### Step 5: OpenAI Integration
- [x] **COMPLETE**

**Task**: Set up connection to OpenAI for query generation and content creation.
**Implementation**:
- Create a robust OpenAI client in `lib/ai/openai.ts`:
  1. **Client Configuration**:
     - Implement proper API key handling
     - Set up request timeouts and retries
     - Create type-safe wrapper for OpenAI API

  2. **Error Handling**:
     - Implement comprehensive error handling
     - Create custom error types for different failure modes
     - Set up logging for API errors

  3. **Rate Limiting**:
     - Implement token counting for requests
     - Create queue system for handling multiple requests
     - Set up retry logic with exponential backoff

  4. **Model Management**:
     - Support multiple OpenAI models (GPT-3.5, GPT-4)
     - Implement model fallback options
     - Allow configuration of model parameters

**Deliverables**:
- Complete OpenAI client implementation
- Error handling and retry logic
- Rate limiting implementation
- Model configuration options
- Type definitions for request/response data
- Utility functions for common operations

**Tests**:
1. Test that the OpenAI client initializes correctly with API key and validates configuration
2. Test that the client can make a simple completion request and receive a valid response
3. Test that error handling works correctly with invalid inputs or API issues (rate limits, timeouts, etc.)

**Checkpoint Test**: Verify OpenAI connection works by generating a test completion.
```bash
npm run test:openai
```
**Commit Message**: "Add OpenAI integration with error handling"

### Step 6: Query Generation Implementation
- [x] **COMPLETE**

**Task**: Implement query generation logic that turns business descriptions into effective search queries.
**Implementation**:
- Enhance `query-generation.ts` to:
  1. **Business Input Processing**:
     - Extract key information from business descriptions
     - Identify target audience, location, and service offerings
     - Normalize and validate input data

  2. **AI-based Query Generation**:
     - Leverage OpenAI to create targeted search queries
     - Focus on local businesses (for location-based services)
     - Generate variations for different search intents
     - Prioritize high-value potential leads

  3. **Query Management**:
     - Implement scoring system for query relevance
     - Sort queries by potential value
     - Filter out low-quality or redundant queries
     - Track query performance metrics

  4. **Diversification Strategies**:
     - Generate complementary queries spanning different intent types
     - Create queries targeting specific roles (e.g., "chief dental officer")
     - Include niche-specific terminology
     - Generate location-based variations

**Deliverables**:
- Enhanced query generation module with advanced functionality
- AI-powered business input analyzer
- Query diversification system
- Query scoring and prioritization logic
- Comprehensive types and interfaces
- Error handling for all edge cases
- Logging for debugging and performance tracking

**Tests**:
1. Test that the query generator can process a basic business description and produce relevant queries
2. Test that the generator produces diverse query types based on the same input
3. Test that location-based queries are correctly formatted and prioritized
4. Test error handling with invalid inputs (empty strings, malformed data, etc.)
5. Test scoring and prioritization of generated queries

**Checkpoint Test**: Verify query generation with sample business descriptions.
```bash
npm run test:query-generation
```
**Commit Message**: "Implement AI-powered query generation"

### Step 7: Brave Search API Integration
- [x] **COMPLETE**

**Task**: Set up connection to Brave Search for search query execution.
**Implementation**:
- Create Brave Search client in `lib/search-service.ts`:
  1. **Client Configuration**:
     - Implement proper API key handling
     - Set up request timeouts and retries
     - Create type-safe wrapper for Brave Search API

  2. **Error Handling**:
     - Implement comprehensive error handling
     - Create custom error types for different failure modes
     - Set up logging for API errors

  3. **Rate Limiting**:
     - Implement token counting for requests
     - Create queue system for handling multiple requests
     - Set up retry logic with exponential backoff

  4. **Model Management**:
     - Support multiple Brave Search models (GPT-3.5, GPT-4)
     - Implement model fallback options
     - Allow configuration of model parameters

**Deliverables**:
- Complete Brave Search client implementation
- Error handling and retry logic
- Rate limiting implementation
- Model configuration options
- Type definitions for request/response data
- Utility functions for common operations

**Tests**:
1. Test that the Brave Search client initializes correctly with API key and validates configuration
2. Test that the client can make a simple completion request and receive a valid response
3. Test that error handling works correctly with invalid inputs or API issues (rate limits, timeouts, etc.)

**Checkpoint Test**: Verify Brave Search connection works by generating a test completion.
```bash
npm run test:brave-search
```
**Commit Message**: "Add Brave Search API integration with error handling"

### Step 8: Search Results Processing
- [x] **COMPLETE**

**Task**: Implement search results processing logic to extract business information.
**Implementation**:
- Enhance `search-service.ts` to:
  1. **Result Parsing**:
     - Implement parsing logic for different search result formats
     - Create reusable parsing functions
     - Set up error handling for parsing failures

  2. **Data Extraction**:
     - Extract relevant information from parsed results
     - Create structured data objects
     - Set up data validation and cleaning

  3. **Filtering and Sorting**:
     - Implement filtering criteria for relevant results
     - Create sorting logic based on relevance
     - Set up result ranking system

  4. **Storage and Indexing**:
     - Store extracted data in database
     - Implement indexing for efficient search
     - Set up data version control

**Deliverables**:
- Complete search results processing logic
- Result parsing and extraction
- Data validation and cleaning
- Filtering and sorting logic
- Result ranking system
- Database schema for search results
- Tests for search results processing functionality

**Checkpoint Test**: Verify search results processing with test data.
```bash
npm run test:search-results
```
**Commit Message**: "Implement search results processing logic"

### Phase 2 Integration Test
**Task**: Verify the complete search and query generation system.
**Test Steps**:
1. Test OpenAI integration with sample business descriptions
2. Verify Brave Search connection
3. Test search results processing with test data
4. Confirm end-to-end search and query generation

**Success Criteria**:
- OpenAI integration works correctly with sample business descriptions
- Brave Search connection is established
- Search results are processed and extracted correctly
- End-to-end search and query generation works
- System handles errors and failures gracefully
- Results are accurate and stored properly

```bash
npm run test:phase2
```
**Commit Message**: "Complete Phase 2: Search and Query Generation"

## Phase 3: Web Scraping Components

### Step 9: Scraping Engine Enhancement
- [ ] **COMPLETE**

**Task**: Enhance the scraping engine for full workflow management.
**Implementation**:
- Complete the scraping process orchestration:
  1. **Process Management**:
     - Implement job-based scraping process
     - Create state machine for scrape workflow
     - Handle multi-step scraping operations

  2. **Progress Tracking**:
     - Implement detailed progress tracking
     - Create progress reporting mechanisms
     - Track time estimates and completion

  3. **Error Recovery**:
     - Implement robust error recovery
     - Allow resuming failed scrapes
     - Create checkpoint system for long processes

  4. **Resource Optimization**:
     - Implement parallel processing where possible
     - Optimize resource usage for different tasks
     - Balance speed and reliability

**Deliverables**:
- Complete scraping controller system
- Process management and state machine
- Progress tracking and reporting
- Error recovery and resumption
- Resource optimization and balancing
- Database schema for scrape jobs
- UI components for progress display
- Tests for scrape controller functionality

**Checkpoint Test**: Verify scrape controller manages full process.
```bash
npm run test:scrape-controller
```
**Commit Message**: "Enhance scraping engine for workflow management"

### Step 10: Lead Generation Pipeline
- [ ] **COMPLETE**

**Task**: Build the complete lead generation pipeline.
**Implementation**:
- Connect query generation, search, and scraping:
  1. **Pipeline Integration**:
     - Connect query generation to search
     - Link search results to scraping
     - Create unified pipeline controller

  2. **Lead Processing**:
     - Implement lead filtering criteria
     - Create lead scoring algorithm
     - Prioritize leads based on potential

  3. **Database Storage**:
     - Store leads with all relevant data
     - Implement lead status tracking
     - Create lead update mechanisms

  4. **Pipeline Monitoring**:
     - Track pipeline performance metrics
     - Monitor success rates for each stage
     - Identify bottlenecks and issues

**Deliverables**:
- Complete lead generation pipeline
- Integrated query, search, and scraping
- Lead filtering and prioritization
- Database schema for leads
- Pipeline monitoring and metrics
- UI components for lead management
- Tests for pipeline functionality

**Checkpoint Test**: Verify end-to-end lead generation pipeline.
```bash
npm run test:lead-pipeline
```
**Commit Message**: "Build complete lead generation pipeline"

### Step 11: Outreach Campaign Management
- [ ] **COMPLETE**

**Task**: Implement campaign management for outreach.
**Implementation**:
- Create campaign management system:
  1. **Campaign Creation**:
     - Implement campaign creation UI
     - Create campaign configuration options
     - Set up campaign templates

  2. **Lead Targeting**:
     - Create lead selection mechanisms
     - Implement audience segmentation
     - Set up targeting criteria

  3. **Campaign Scheduling**:
     - Implement scheduling and timing options
     - Create pacing controls
     - Set up sending windows and limits

  4. **Performance Tracking**:
     - Track campaign performance metrics
     - Monitor response rates and engagement
     - Create campaign analytics

**Deliverables**:
- Complete campaign management system
- Campaign creation and configuration
- Lead targeting and selection
- Campaign scheduling and pacing
- Performance tracking and analytics
- Database schema for campaigns
- UI components for campaign management
- Tests for campaign functionality

**Checkpoint Test**: Verify campaign creation and configuration.
```bash
npm run test:campaign-management
```
**Commit Message**: "Implement outreach campaign management"

### Step 12: Background Processing
- [ ] **COMPLETE**

**Task**: Set up background processing for asynchronous tasks.
**Implementation**:
- Implement job queue for long-running tasks:
  1. **Job Queue System**:
     - Create job queue infrastructure
     - Implement worker processes
     - Set up job prioritization

  2. **Task Execution**:
     - Implement task execution framework
     - Create handlers for different job types
     - Set up parallel processing where possible

  3. **Monitoring and Failure Recovery**:
     - Implement job status monitoring
     - Create failure detection and recovery
     - Set up retry mechanisms

  4. **Resource Management**:
     - Implement resource allocation
     - Balance load across workers
     - Control concurrency and rate limits

**Deliverables**:
- Complete background processing system
- Job queue implementation
- Task execution framework
- Monitoring and failure recovery
- Resource management and load balancing
- Database schema for job queue
- UI components for job monitoring
- Tests for background processing functionality

**Checkpoint Test**: Verify background processing with test jobs.
```bash
npm run test:background-jobs
```
**Commit Message**: "Set up background processing for async tasks"

### Step 13: Scheduled Operations
- [ ] **COMPLETE**

**Task**: Add scheduling for automated operations.
**Implementation**:
- Implement scheduling for automated tasks:
  1. **Cron Job Setup**:
     - Implement cron job infrastructure
     - Create scheduled task registration
     - Set up execution tracking

  2. **Campaign Scheduling**:
     - Implement campaign scheduling
     - Create sending windows and limits
     - Set up time zone handling

  3. **Follow-up Scheduling**:
     - Implement automatic follow-up scheduling
     - Create follow-up rules and conditions
     - Set up time-based triggers

  4. **Schedule Management**:
     - Create UI for schedule management
     - Implement schedule editing and pausing
     - Set up schedule conflict resolution

**Deliverables**:
- Complete scheduled operations system
- Cron job infrastructure
- Campaign scheduling functionality
- Follow-up scheduling logic
- Schedule management UI
- Database schema for schedules
- Tests for scheduling functionality

**Checkpoint Test**: Verify scheduled operations execute properly.
```bash
npm run test:scheduled-ops
```
**Commit Message**: "Add scheduling for automated operations"

### Phase 3 Integration Test
**Task**: Verify the complete lead generation pipeline.
**Test Steps**:
1. Test end-to-end lead generation pipeline
2. Verify campaign configuration and management
3. Test background processing and job queue
4. Confirm scheduled operations execute correctly

**Success Criteria**:
- Lead generation pipeline works end-to-end
- Campaigns can be created, configured, and executed
- Background jobs are properly queued and processed
- Scheduled operations run at the correct times
- System handles errors and failures gracefully
- Resources are properly managed and monitored

```bash
npm run test:phase3
```
**Commit Message**: "Complete Phase 3: Web Scraping Components"

## Phase 4: Contact Research and Enrichment

### Step 14: Contact Research Enhancement
- [ ] **COMPLETE**

**Task**: Enhance the contact research process for full workflow management.
**Implementation**:
- Complete the research process orchestration:
  1. **Process Management**:
     - Implement job-based research process
     - Create state machine for research workflow
     - Handle multi-step research operations

  2. **Progress Tracking**:
     - Implement detailed progress tracking
     - Create progress reporting mechanisms
     - Track time estimates and completion

  3. **Error Recovery**:
     - Implement robust error recovery
     - Allow resuming failed research
     - Create checkpoint system for long processes

  4. **Resource Optimization**:
     - Implement parallel processing where possible
     - Optimize resource usage for different tasks
     - Balance speed and reliability

**Deliverables**:
- Complete research controller system
- Process management and state machine
- Progress tracking and reporting
- Error recovery and resumption
- Resource optimization and balancing
- Database schema for research jobs
- UI components for progress display
- Tests for research controller functionality

**Checkpoint Test**: Verify research controller manages full process.
```bash
npm run test:research-controller
```
**Commit Message**: "Enhance contact research process for workflow management"

### Step 15: Lead Scoring System
- [ ] **COMPLETE**

**Task**: Build an AI-based lead scoring system.
**Implementation**:
- Create lead scoring system:
  1. **Quality Assessment**:
     - Implement lead quality evaluation
     - Create scoring criteria
     - Set up multi-factor analysis

  2. **Response Prediction**:
     - Implement likelihood prediction
     - Create engagement forecasting
     - Set up conversion potential

  3. **Prioritization**:
     - Implement combined factor scoring
     - Create dynamic prioritization
     - Set up time-sensitive factors

  4. **Score Visualization**:
     - Implement score display
     - Create factor breakdown
     - Set up comparison tools

**Deliverables**:
- Complete lead scoring system
- Quality assessment algorithm
- Response likelihood prediction
- Prioritization based on combined factors
- Score visualization and explanation
- Tests for lead scoring functionality

**Checkpoint Test**: Verify lead scoring system.
```bash
npm run test:lead-scoring
```
**Commit Message**: "Build AI-based lead scoring system"

### Step 16: Smart Scheduling
- [ ] **COMPLETE**

**Task**: Implement smart scheduling for email sending.
**Implementation**:
- Create smart scheduling system:
  1. **Time Zone Detection**:
     - Implement recipient time zone detection
     - Create local time conversion
     - Set up time zone database

  2. **Optimal Timing**:
     - Implement best time prediction
     - Create industry-specific timing
     - Set up personalized timing

  3. **Adaptive Scheduling**:
     - Implement response pattern analysis
     - Create adaptive timing adjustments
     - Set up performance-based optimization

  4. **Schedule Visualization**:
     - Implement schedule calendar
     - Create timing recommendations
     - Set up manual override options

**Deliverables**:
- Complete smart scheduling system
- Time zone detection and handling
- Optimal timing prediction
- Adaptive scheduling based on patterns
- Schedule visualization and calendar
- Tests for smart scheduling functionality

**Checkpoint Test**: Verify smart scheduling functionality.
```bash
npm run test:smart-scheduling
```
**Commit Message**: "Implement smart scheduling for email sending"

### Step 17: Advanced Personalization
- [ ] **COMPLETE**

**Task**: Add advanced personalization capabilities.
**Implementation**:
- Create advanced personalization system:
  1. **Deep Research Integration**:
     - Implement comprehensive research data
     - Create deep personalization strategies
     - Set up multi-source verification

  2. **Multi-Source Synthesis**:
     - Implement data synthesis from multiple sources
     - Create coherent personalization narrative
     - Set up confidence-based application

  3. **Psychological Matching**:
     - Implement tone and approach matching
     - Create personality-based communication
     - Set up empathy and rapport building

  4. **Personalization Testing**:
     - Implement personalization effectiveness
     - Create A/B testing for personalization
     - Set up performance tracking

**Deliverables**:
- Complete advanced personalization system
- Deep research integration
- Multi-source data synthesis
- Psychological matching and tone
- Personalization testing and optimization
- Tests for advanced personalization functionality

**Checkpoint Test**: Verify advanced personalization features.
```bash
npm run test:advanced-personalization
```
**Commit Message**: "Add advanced personalization capabilities"

### Step 18: Custom Email Templates
- [ ] **COMPLETE**

**Task**: Implement custom email template creation.
**Implementation**:
- Create custom template system:
  1. **Template Editor**:
     - Implement visual template editor
     - Create formatting and layout tools
     - Set up template components

  2. **Variable Management**:
     - Implement variable insertion system
     - Create dynamic content blocks
     - Set up conditional sections

  3. **Template Testing**:
     - Implement template preview
     - Create spam score checking
     - Set up rendering tests

  4. **Template Library**:
     - Implement template storage
     - Create categorization and tagging
     - Set up sharing and duplication

**Deliverables**:
- Complete custom template system
- Visual template editor
- Variable management system
- Template testing and validation
- Template library and organization
- Tests for custom template functionality

**Checkpoint Test**: Verify custom template creation.
```bash
npm run test:custom-templates
```
**Commit Message**: "Implement custom email template creation"

### Phase 4 Integration Test
**Task**: Verify the complete contact research and enrichment system.
**Test Steps**:
1. Test end-to-end research process
2. Verify lead scoring system
3. Test smart scheduling across time zones
4. Confirm advanced personalization and custom templates

**Success Criteria**:
- Research process works end-to-end
- Lead scoring accurately prioritizes leads
- Smart scheduling suggests optimal sending times
- Advanced personalization creates relevant content
- Custom templates can be created and used
- All research features work together seamlessly

```bash
npm run test:phase4
```
**Commit Message**: "Complete Phase 4: Contact Research and Enrichment"

## Phase 5: Email Generation and Sending

### Step 19: Email Sending Service
- [x] **COMPLETE**

**Task**: Build the email sending service with retries and tracking.
**Implementation**:
- Implement email sending service:
  1. **Sending Queue**:
     - Create queue for outgoing emails
     - Implement rate limiting and scheduling
     - Handle priority and batching

  2. **Retry Logic**:
     - Implement retry mechanism for failed sends
     - Use exponential backoff for retries
     - Set maximum retry attempts

  3. **Status Tracking**:
     - Track email status (queued, sent, delivered)
     - Store delivery confirmations
     - Monitor for bounces and failures

  4. **Performance Monitoring**:
     - Track sending performance metrics
     - Monitor queue size and processing time
     - Alert on significant issues

**Deliverables**:
- Complete email sending service
- Sending queue implementation
- Retry logic and error handling
- Status tracking and monitoring
- Performance metrics and alerting
- Database schema for sending queue
- Tests for sending service functionality

**Checkpoint Test**: Verify email sending with retry logic.
```bash
npm run test:email-sending
```
**Commit Message**: "Build email sending service with retries and tracking"

### Step 20: Email Response Handling
- [ ] **COMPLETE**

**Task**: Implement email response detection and handling.
**Implementation**:
- Set up email response handling:
  1. **Webhook Configuration**:
     - Set up Gmail webhook for incoming emails
     - Configure event filtering and processing
     - Handle webhook authentication

  2. **Response Classification**:
     - Implement AI-based response classification
     - Categorize responses (positive, negative, question)
     - Extract key information from responses

  3. **Thread Management**:
     - Track email threads and conversations
     - Link responses to original emails
     - Build conversation history

  4. **Notification System**:
     - Notify users of important responses
     - Prioritize responses requiring attention
     - Create summary of response activity

**Deliverables**:
- Complete email response handling system
- Webhook configuration and processing
- Response classification with AI
- Thread management and tracking
- Notification system for responses
- Database schema for response tracking
- Tests for response handling functionality

**Checkpoint Test**: Verify response detection and classification.
```bash
npm run test:response-handling
```
**Commit Message**: "Implement email response detection and handling"

### Step 21: Email Template System
- [ ] **COMPLETE**

**Task**: Complete the email template system.
**Implementation**:
- Finalize email template structure:
  1. **Template Architecture**:
     - Create flexible template system
     - Implement variable substitution
     - Support different email types and formats

  2. **Variable Handling**:
     - Implement dynamic variable insertion
     - Create fallback values for missing variables
     - Validate template variables

  3. **Template Selection**:
     - Implement logic for selecting appropriate templates
     - Consider factors like industry, contact role, etc.
     - Allow manual template selection

  4. **Template Management**:
     - Store templates in database
     - Implement version control for templates
     - Enable creation of custom templates

**Deliverables**:
- Complete email template system
- Template architecture and structure
- Variable handling and substitution
- Template selection logic
- Template management and storage
- Database schema for templates
- UI components for template management
- Tests for template system functionality

**Checkpoint Test**: Verify template system works with variable substitution.
```bash
npm run test:email-templates
```
**Commit Message**: "Complete email template system with variable handling"

### Step 22: Drip Campaign Logic
- [ ] **COMPLETE**

**Task**: Implement drip campaign logic for email sending.
**Implementation**:
- Create drip campaign system:
  1. **Campaign Setup**:
     - Implement campaign setup UI
     - Create campaign configuration options
     - Set up campaign templates

  2. **Lead Targeting**:
     - Create lead selection mechanisms
     - Implement audience segmentation
     - Set up targeting criteria

  3. **Campaign Scheduling**:
     - Implement scheduling and timing options
     - Create pacing controls
     - Set up sending windows and limits

  4. **Campaign Execution**:
     - Implement campaign execution logic
     - Create automated email sequences
     - Set up follow-up rules and triggers

**Deliverables**:
- Complete drip campaign system
- Campaign setup and configuration
- Lead targeting and segmentation
- Campaign scheduling and pacing
- Automated email sequences
- Follow-up rules and triggers
- Tests for drip campaign functionality

**Checkpoint Test**: Verify drip campaign logic works with test data.
```bash
npm run test:drip-campaign
```
**Commit Message**: "Implement drip campaign logic for email sending"

### Phase 5 Integration Test
**Task**: Verify the complete email generation and sending system.
**Test Steps**:
1. Test end-to-end email creation with personalization
2. Verify Gmail authentication and connection
3. Test email sending with retry logic
4. Confirm response handling and thread management

**Success Criteria**:
- System successfully generates personalized emails
- Gmail authentication works properly
- Emails are sent and tracked correctly
- Retries work for failed sends
- Responses are detected and classified
- Threads are properly managed and tracked
- Users are notified of important responses

```bash
npm run test:phase5
```
**Commit Message**: "Complete Phase 5: Email Generation and Sending"

## Phase 6: Workflow Orchestration

### Step 23: Scrape Controller Enhancement
- [ ] **COMPLETE**

**Task**: Enhance the scrape controller for full workflow management.
**Implementation**:
- Complete the scrape process orchestration:
  1. **Process Management**:
     - Implement job-based scraping process
     - Create state machine for scrape workflow
     - Handle multi-step scraping operations

  2. **Progress Tracking**:
     - Implement detailed progress tracking
     - Create progress reporting mechanisms
     - Track time estimates and completion

  3. **Error Recovery**:
     - Implement robust error recovery
     - Allow resuming failed scrapes
     - Create checkpoint system for long processes

  4. **Resource Optimization**:
     - Implement parallel processing where possible
     - Optimize resource usage for different tasks
     - Balance speed and reliability

**Deliverables**:
- Complete scrape controller system
- Process management and state machine
- Progress tracking and reporting
- Error recovery and resumption
- Resource optimization and balancing
- Database schema for scrape jobs
- UI components for progress display
- Tests for scrape controller functionality

**Checkpoint Test**: Verify scrape controller manages full process.
```bash
npm run test:scrape-controller
```
**Commit Message**: "Enhance scrape controller for workflow management"

### Step 24: Lead Generation Pipeline
- [ ] **COMPLETE**

**Task**: Build the complete lead generation pipeline.
**Implementation**:
- Connect query generation, search, and scraping:
  1. **Pipeline Integration**:
     - Connect query generation to search
     - Link search results to scraping
     - Create unified pipeline controller

  2. **Lead Processing**:
     - Implement lead filtering criteria
     - Create lead scoring algorithm
     - Prioritize leads based on potential

  3. **Database Storage**:
     - Store leads with all relevant data
     - Implement lead status tracking
     - Create lead update mechanisms

  4. **Pipeline Monitoring**:
     - Track pipeline performance metrics
     - Monitor success rates for each stage
     - Identify bottlenecks and issues

**Deliverables**:
- Complete lead generation pipeline
- Integrated query, search, and scraping
- Lead filtering and prioritization
- Database schema for leads
- Pipeline monitoring and metrics
- UI components for lead management
- Tests for pipeline functionality

**Checkpoint Test**: Verify end-to-end lead generation pipeline.
```bash
npm run test:lead-pipeline
```
**Commit Message**: "Build complete lead generation pipeline"

### Step 25: Outreach Campaign Management
- [ ] **COMPLETE**

**Task**: Implement campaign management for outreach.
**Implementation**:
- Create campaign management system:
  1. **Campaign Creation**:
     - Implement campaign creation UI
     - Create campaign configuration options
     - Set up campaign templates

  2. **Lead Targeting**:
     - Create lead selection mechanisms
     - Implement audience segmentation
     - Set up targeting criteria

  3. **Campaign Scheduling**:
     - Implement scheduling and timing options
     - Create pacing controls
     - Set up sending windows and limits

  4. **Performance Tracking**:
     - Track campaign performance metrics
     - Monitor response rates and engagement
     - Create campaign analytics

**Deliverables**:
- Complete campaign management system
- Campaign creation and configuration
- Lead targeting and selection
- Campaign scheduling and pacing
- Performance tracking and analytics
- Database schema for campaigns
- UI components for campaign management
- Tests for campaign functionality

**Checkpoint Test**: Verify campaign creation and configuration.
```bash
npm run test:campaign-management
```
**Commit Message**: "Implement outreach campaign management"

### Step 26: Background Processing
- [ ] **COMPLETE**

**Task**: Set up background processing for asynchronous tasks.
**Implementation**:
- Implement job queue for long-running tasks:
  1. **Job Queue System**:
     - Create job queue infrastructure
     - Implement worker processes
     - Set up job prioritization

  2. **Task Execution**:
     - Implement task execution framework
     - Create handlers for different job types
     - Set up parallel processing where possible

  3. **Monitoring and Failure Recovery**:
     - Implement job status monitoring
     - Create failure detection and recovery
     - Set up retry mechanisms

  4. **Resource Management**:
     - Implement resource allocation
     - Balance load across workers
     - Control concurrency and rate limits

**Deliverables**:
- Complete background processing system
- Job queue implementation
- Task execution framework
- Monitoring and failure recovery
- Resource management and load balancing
- Database schema for job queue
- UI components for job monitoring
- Tests for background processing functionality

**Checkpoint Test**: Verify background processing with test jobs.
```bash
npm run test:background-jobs
```
**Commit Message**: "Set up background processing for async tasks"

### Step 27: Scheduled Operations
- [ ] **COMPLETE**

**Task**: Add scheduling for automated operations.
**Implementation**:
- Implement scheduling for automated tasks:
  1. **Cron Job Setup**:
     - Implement cron job infrastructure
     - Create scheduled task registration
     - Set up execution tracking

  2. **Campaign Scheduling**:
     - Implement campaign scheduling
     - Create sending windows and limits
     - Set up time zone handling

  3. **Follow-up Scheduling**:
     - Implement automatic follow-up scheduling
     - Create follow-up rules and conditions
     - Set up time-based triggers

  4. **Schedule Management**:
     - Create UI for schedule management
     - Implement schedule editing and pausing
     - Set up schedule conflict resolution

**Deliverables**:
- Complete scheduled operations system
- Cron job infrastructure
- Campaign scheduling functionality
- Follow-up scheduling logic
- Schedule management UI
- Database schema for schedules
- Tests for scheduling functionality

**Checkpoint Test**: Verify scheduled operations execute properly.
```bash
npm run test:scheduled-ops
```
**Commit Message**: "Add scheduling for automated operations"

### Phase 6 Integration Test
**Task**: Verify the complete workflow orchestration system.
**Test Steps**:
1. Test end-to-end lead generation pipeline
2. Verify campaign configuration and management
3. Test background processing and job queue
4. Confirm scheduled operations execute correctly

**Success Criteria**:
- Lead generation pipeline works end-to-end
- Campaigns can be created, configured, and executed
- Background jobs are properly queued and processed
- Scheduled operations run at the correct times
- System handles errors and failures gracefully
- Resources are properly managed and monitored

```bash
npm run test:phase6
```
**Commit Message**: "Complete Phase 6: Workflow Orchestration"

## Phase 7: Dashboard UI

### Step 28: Dashboard Layout
- [ ] **COMPLETE**

**Task**: Create the main dashboard layout and navigation.
**Implementation**:
- Build responsive dashboard layout:
  1. **Layout Structure**:
     - Create responsive layout with Tailwind CSS
     - Implement sidebar, header, and main content area
     - Set up layout for different screen sizes

  2. **Navigation System**:
     - Implement navigation menu
     - Create breadcrumbs for deep pages
     - Set up route transitions with Framer Motion

  3. **Authentication Integration**:
     - Integrate Supabase auth with dashboard
     - Create protected routes and redirects
     - Implement user session management

  4. **User Profile**:
     - Create user profile section
     - Implement account settings
     - Set up user preferences

**Deliverables**:
- Complete dashboard layout
- Responsive design for all screen sizes
- Navigation system and menu
- Authentication integration
- User profile and settings
- Route protection for authenticated pages
- Tests for layout and navigation functionality

**Checkpoint Test**: Verify dashboard layout and navigation.
```bash
npm run test:dashboard-layout
```
**Commit Message**: "Create dashboard layout and navigation"

### Step 29: Business Profile Display
- [ ] **COMPLETE**

**Task**: Implement the business profile display component.
**Implementation**:
- Create business profile display:
  1. **Profile Cards**:
     - Implement business profile cards
     - Create detailed profile view
     - Set up edit functionality

  2. **Team Member Display**:
     - Create team member cards and list
     - Implement team member detail view
     - Set up filtering and sorting

  3. **Contact Information**:
     - Display contact information clearly
     - Implement copy and export functionality
     - Create validation indicators

  4. **Data Visualization**:
     - Implement charts and graphs for profile data
     - Create visual indicators for status
     - Set up timeline for activities

**Deliverables**:
- Complete business profile display components
- Profile cards and detailed view
- Team member visualization
- Contact information display
- Data visualization for profile data
- Edit functionality for profiles
- Tests for profile display functionality

**Checkpoint Test**: Verify business profile display with test data.
```bash
npm run test:profile-display
```
**Commit Message**: "Implement business profile display components"

### Step 30: Lead Management UI
- [ ] **COMPLETE**

**Task**: Build the lead management interface.
**Implementation**:
- Create lead management UI:
  1. **Lead Listing**:
     - Implement lead list with filtering
     - Create lead cards and detailed view
     - Set up sorting and pagination

  2. **Prioritization Controls**:
     - Implement lead scoring display
     - Create manual prioritization controls
     - Set up automated prioritization

  3. **Status Management**:
     - Implement lead status tracking
     - Create status change workflow
     - Set up status filtering

  4. **Bulk Operations**:
     - Implement bulk selection of leads
     - Create bulk action controls
     - Set up confirmation flows

**Deliverables**:
- Complete lead management interface
- Lead listing with filtering and sorting
- Prioritization controls and scoring
- Status management workflow
- Bulk operation functionality
- Tests for lead management functionality

**Checkpoint Test**: Verify lead management UI functionality.
```bash
npm run test:lead-management-ui
```
**Commit Message**: "Build lead management interface"

### Step 31: Email Composition UI
- [ ] **COMPLETE**

**Task**: Create the email composition interface.
**Implementation**:
- Build email composition UI:
  1. **Template Selection**:
     - Implement template browsing and selection
     - Create template preview
     - Set up template filtering

  2. **Editor Interface**:
     - Create rich text editor for emails
     - Implement personalization variable insertion
     - Set up formatting controls

  3. **Preview System**:
     - Implement email preview with personalization
     - Create mobile and desktop previews
     - Set up spam score checking

  4. **Personalization Controls**:
     - Implement personalization variable browser
     - Create custom personalization options
     - Set up AI-assisted personalization

**Deliverables**:
- Complete email composition interface
- Template selection and preview
- Rich text editor with formatting
- Email preview system
- Personalization controls
- Spam score checking
- Tests for email composition functionality

**Checkpoint Test**: Verify email composition UI.
```bash
npm run test:email-composition
```
**Commit Message**: "Create email composition interface"

### Step 32: Campaign Monitoring
- [ ] **COMPLETE**

**Task**: Implement campaign monitoring dashboard.
**Implementation**:
- Create campaign monitoring UI:
  1. **Performance Metrics**:
     - Implement key performance indicators
     - Create metrics dashboard
     - Set up trend visualization

  2. **Email Status Tracking**:
     - Implement email status display
     - Create detailed status view
     - Set up status filtering

  3. **Response Monitoring**:
     - Implement response tracking
     - Create response classification display
     - Set up notification system

  4. **Campaign Timeline**:
     - Implement campaign activity timeline
     - Create event visualization
     - Set up filtering and searching

**Deliverables**:
- Complete campaign monitoring dashboard
- Performance metrics and KPIs
- Email status tracking
- Response monitoring and classification
- Campaign timeline and events
- Notification system for important events
- Tests for campaign monitoring functionality

**Checkpoint Test**: Verify campaign monitoring with test data.
```bash
npm run test:campaign-monitoring
```
**Commit Message**: "Implement campaign monitoring dashboard"

### Step 33: Settings and Configuration UI
- [ ] **COMPLETE**

**Task**: Build settings and configuration interface.
**Implementation**:
- Create settings and configuration UI:
  1. **User Profile Settings**:
     - Implement profile editing
     - Create account settings
     - Set up notification preferences

  2. **Gmail Connection Management**:
     - Implement Gmail connection UI
     - Create connection status display
     - Set up troubleshooting tools

  3. **System Configuration**:
     - Implement system settings
     - Create defaults and preferences
     - Set up advanced configuration

  4. **Supabase Auth Integration**:
     - Implement account management
     - Create password change functionality
     - Set up multi-factor authentication

**Deliverables**:
- Complete settings and configuration interface
- User profile management
- Gmail connection controls
- System configuration options
- Supabase Auth integration
- Tests for settings functionality

**Checkpoint Test**: Verify settings and configuration UI.
```bash
npm run test:settings-ui
```
**Commit Message**: "Build settings and configuration interface"

### Phase 7 Integration Test
**Task**: Verify the complete dashboard UI system.
**Test Steps**:
1. Test responsive layout across device sizes
2. Verify all UI components render correctly
3. Test authentication integration in UI
4. Confirm data display and interaction functionality

**Success Criteria**:
- Dashboard layout is responsive on all screen sizes
- All UI components display and function correctly
- Authentication works seamlessly with the UI
- Data is displayed correctly and can be interacted with
- Settings can be changed and saved
- Campaign monitoring shows accurate information
- Email composition works with templates and preview

```bash
npm run test:phase7
```
**Commit Message**: "Complete Phase 7: Dashboard UI"

## Phase 8: Integration and End-to-End Functionality

### Step 34: Input Flow Implementation
- [ ] **COMPLETE**

**Task**: Create the business description input flow.
**Implementation**:
- Build business description input:
  1. **Input Wizard**:
     - Create multi-step input wizard
     - Implement progress tracking
     - Set up validation and error handling

  2. **Industry Selection**:
     - Implement industry dropdown or search
     - Create location selection
     - Set up business type categorization

  3. **Business Description**:
     - Implement detailed description input
     - Create AI-assisted description enhancement
     - Set up keyword extraction

  4. **Goal Setting**:
     - Implement outreach goal setting
     - Create target audience definition
     - Set up success criteria

**Deliverables**:
- Complete business description input flow
- Multi-step wizard implementation
- Industry and location selection
- Business description input with AI assistance
- Goal setting and target definition
- Validation and error handling
- Tests for input flow functionality

**Checkpoint Test**: Verify business input flow works.
```bash
npm run test:input-flow
```
**Commit Message**: "Create business description input flow"

### Step 35: Search Visualization
- [ ] **COMPLETE**

**Task**: Implement search process visualization.
**Implementation**:
- Create search visualization UI:
  1. **Query Display**:
     - Implement search query visualization
     - Create query editing interface
     - Set up query performance metrics

  2. **Results Visualization**:
     - Implement search results display
     - Create result details view
     - Set up result filtering and sorting

  3. **Selection Controls**:
     - Implement result selection interface
     - Create batch selection tools
     - Set up selection criteria

  4. **Process Monitoring**:
     - Implement search process status
     - Create progress indicators
     - Set up error reporting

**Deliverables**:
- Complete search visualization interface
- Query display and editing
- Results visualization with details
- Selection controls and batch tools
- Process monitoring and status
- Tests for search visualization functionality

**Checkpoint Test**: Verify search visualization with test data.
```bash
npm run test:search-visualization
```
**Commit Message**: "Implement search process visualization"

### Step 36: Scraping Progress Display
- [ ] **COMPLETE**

**Task**: Build scraping progress visualization.
**Implementation**:
- Create scraping progress UI:
  1. **Progress Indicators**:
     - Implement overall progress tracking
     - Create per-site progress indicators
     - Set up completion estimation

  2. **Scraping Logs**:
     - Implement detailed scraping logs
     - Create log filtering and search
     - Set up log level controls

  3. **Error Notifications**:
     - Implement error display
     - Create error details and context
     - Set up error resolution suggestions

  4. **Result Preview**:
     - Implement live result preview
     - Create partial result display
     - Set up result verification

**Deliverables**:
- Complete scraping progress visualization
- Progress indicators and tracking
- Detailed scraping logs
- Error notifications and handling
- Result preview and verification
- Tests for scraping progress functionality

**Checkpoint Test**: Verify scraping progress display.
```bash
npm run test:scrape-progress
```
**Commit Message**: "Build scraping progress visualization"

### Step 37: Research Insights UI
- [ ] **COMPLETE**

**Task**: Implement research insights display.
**Implementation**:
- Create research insights UI:
  1. **Contact Research Visualization**:
     - Implement research results display
     - Create detailed profile view
     - Set up research source tracking

  2. **Personal Insights Display**:
     - Implement personal insights visualization
     - Create interest and background display
     - Set up personalization suggestions

  3. **Connection Discovery**:
     - Implement connection mapping
     - Create relationship visualization
     - Set up common interest highlighting

  4. **Research Timeline**:
     - Implement research history timeline
     - Create event visualization
     - Set up filtering and searching

**Deliverables**:
- Complete research insights interface
- Research results visualization
- Personal insights display
- Connection discovery and mapping
- Research timeline and history
- Tests for research insights functionality

**Checkpoint Test**: Verify research insights display.
```bash
npm run test:research-insights
```
**Commit Message**: "Implement research insights display"

### Step 38: Email Workflow UI
- [ ] **COMPLETE**

**Task**: Build the email workflow interface.
**Implementation**:
- Create email workflow UI:
  1. **Email Queue Display**:
     - Implement email queue visualization
     - Create status indicators
     - Set up queue management

  2. **Batch Email Management**:
     - Implement batch selection and actions
     - Create approval workflow
     - Set up scheduling controls

  3. **Response Tracking**:
     - Implement response visualization
     - Create conversation threads
     - Set up response metrics

  4. **Workflow Controls**:
     - Implement workflow management
     - Create pausing and resuming
     - Set up workflow customization

**Deliverables**:
- Complete email workflow interface
- Email queue visualization
- Batch management and approval
- Response tracking and threading
- Workflow controls and customization
- Tests for email workflow functionality

**Checkpoint Test**: Verify email workflow interface.
```bash
npm run test:email-workflow
```
**Commit Message**: "Build email workflow interface"

### Step 39: Autonomous Mode Controls
- [ ] **COMPLETE**

**Task**: Implement controls for autonomous operation.
**Implementation**:
- Create autonomous mode UI:
  1. **Mode Configuration**:
     - Implement autonomous mode settings
     - Create rule definition interface
     - Set up permission levels

  2. **Safeguards and Limits**:
     - Implement rate limiting controls
     - Create content approval systems
     - Set up emergency stop mechanisms

  3. **Monitoring and Notifications**:
     - Implement activity monitoring
     - Create notification settings
     - Set up alert thresholds

  4. **Override Controls**:
     - Implement manual override
     - Create intervention points
     - Set up approval requirements

**Deliverables**:
- Complete autonomous mode controls
- Configuration interface and settings
- Safeguards and limitation system
- Monitoring and notification system
- Override controls and interventions
- Tests for autonomous mode functionality

**Checkpoint Test**: Verify autonomous mode controls.
```bash
npm run test:autonomous-controls
```
**Commit Message**: "Implement autonomous mode controls"

### Phase 8 Integration Test
**Task**: Verify complete end-to-end functionality.
**Test Steps**:
1. Test business input to email sending flow
2. Verify all visualization components
3. Test autonomous operation with safeguards
4. Confirm error handling and recovery

**Success Criteria**:
- Complete workflow from business input to email sending works
- All visualization components display accurate information
- Autonomous mode operates within defined safeguards
- System handles errors gracefully and recovers
- User can intervene at any point in the process
- Results are accurate and properly stored

```bash
npm run test:phase8
```
**Commit Message**: "Complete Phase 8: Integration and End-to-End Functionality"

## Phase 9: AI Enhancement and Advanced Features

### Step 40: Conversation AI
- [ ] **COMPLETE**

**Task**: Implement AI for handling email conversations.
**Implementation**:
- Build conversation AI system:
  1. **Response Analysis**:
     - Implement AI-based response analysis
     - Create intent detection
     - Set up sentiment analysis

  2. **Reply Generation**:
     - Implement contextual reply generation
     - Create personalized response templates
     - Set up tone and style matching

  3. **Conversation Strategy**:
     - Implement conversation flow management
     - Create follow-up strategies
     - Set up objection handling

  4. **Learning System**:
     - Implement performance tracking
     - Create feedback loop for improvement
     - Set up A/B testing for responses

**Deliverables**:
- Complete conversation AI system
- Response analysis with intent detection
- Contextual reply generation
- Conversation strategy management
- Learning and improvement system
- Tests for conversation AI functionality

**Checkpoint Test**: Verify conversation AI with test responses.
```bash
npm run test:conversation-ai
```
**Commit Message**: "Implement AI for handling email conversations"

### Step 41: Lead Scoring System
- [ ] **COMPLETE**

**Task**: Build an AI-based lead scoring system.
**Implementation**:
- Create lead scoring system:
  1. **Quality Assessment**:
     - Implement lead quality evaluation
     - Create scoring criteria
     - Set up multi-factor analysis

  2. **Response Prediction**:
     - Implement likelihood prediction
     - Create engagement forecasting
     - Set up conversion potential

  3. **Prioritization**:
     - Implement combined factor scoring
     - Create dynamic prioritization
     - Set up time-sensitive factors

  4. **Score Visualization**:
     - Implement score display
     - Create factor breakdown
     - Set up comparison tools

**Deliverables**:
- Complete lead scoring system
- Quality assessment algorithm
- Response likelihood prediction
- Prioritization based on combined factors
- Score visualization and explanation
- Tests for lead scoring functionality

**Checkpoint Test**: Verify lead scoring system.
```bash
npm run test:lead-scoring
```
**Commit Message**: "Build AI-based lead scoring system"

### Step 42: Smart Scheduling
- [ ] **COMPLETE**

**Task**: Implement smart scheduling for email sending.
**Implementation**:
- Create smart scheduling system:
  1. **Time Zone Detection**:
     - Implement recipient time zone detection
     - Create local time conversion
     - Set up time zone database

  2. **Optimal Timing**:
     - Implement best time prediction
     - Create industry-specific timing
     - Set up personalized timing

  3. **Adaptive Scheduling**:
     - Implement response pattern analysis
     - Create adaptive timing adjustments
     - Set up performance-based optimization

  4. **Schedule Visualization**:
     - Implement schedule calendar
     - Create timing recommendations
     - Set up manual override options

**Deliverables**:
- Complete smart scheduling system
- Time zone detection and handling
- Optimal timing prediction
- Adaptive scheduling based on patterns
- Schedule visualization and calendar
- Tests for smart scheduling functionality

**Checkpoint Test**: Verify smart scheduling functionality.
```bash
npm run test:smart-scheduling
```
**Commit Message**: "Implement smart scheduling for email sending"

### Step 43: Advanced Personalization
- [ ] **COMPLETE**

**Task**: Add advanced personalization capabilities.
**Implementation**:
- Create advanced personalization system:
  1. **Deep Research Integration**:
     - Implement comprehensive research data
     - Create deep personalization strategies
     - Set up multi-source verification

  2. **Multi-Source Synthesis**:
     - Implement data synthesis from multiple sources
     - Create coherent personalization narrative
     - Set up confidence-based application

  3. **Psychological Matching**:
     - Implement tone and approach matching
     - Create personality-based communication
     - Set up empathy and rapport building

  4. **Personalization Testing**:
     - Implement personalization effectiveness
     - Create A/B testing for personalization
     - Set up performance tracking

**Deliverables**:
- Complete advanced personalization system
- Deep research integration
- Multi-source data synthesis
- Psychological matching and tone
- Personalization testing and optimization
- Tests for advanced personalization functionality

**Checkpoint Test**: Verify advanced personalization features.
```bash
npm run test:advanced-personalization
```
**Commit Message**: "Add advanced personalization capabilities"

### Step 44: Custom Email Templates
- [ ] **COMPLETE**

**Task**: Implement custom email template creation.
**Implementation**:
- Create custom template system:
  1. **Template Editor**:
     - Implement visual template editor
     - Create formatting and layout tools
     - Set up template components

  2. **Variable Management**:
     - Implement variable insertion system
     - Create dynamic content blocks
     - Set up conditional sections

  3. **Template Testing**:
     - Implement template preview
     - Create spam score checking
     - Set up rendering tests

  4. **Template Library**:
     - Implement template storage
     - Create categorization and tagging
     - Set up sharing and duplication

**Deliverables**:
- Complete custom template system
- Visual template editor
- Variable management system
- Template testing and validation
- Template library and organization
- Tests for custom template functionality

**Checkpoint Test**: Verify custom template creation.
```bash
npm run test:custom-templates
```
**Commit Message**: "Implement custom email template creation"

### Phase 9 Integration Test
**Task**: Verify all AI enhancement features.
**Test Steps**:
1. Test conversation AI with sample responses
2. Verify lead scoring on test dataset
3. Test smart scheduling across time zones
4. Confirm advanced personalization and custom templates

**Success Criteria**:
- Conversation AI handles responses appropriately
- Lead scoring accurately prioritizes leads
- Smart scheduling suggests optimal sending times
- Advanced personalization creates relevant content
- Custom templates can be created and used
- All AI features work together seamlessly

```bash
npm run test:phase9
```
**Commit Message**: "Complete Phase 9: AI Enhancement and Advanced Features"

## Phase 10: Analytics, Optimization, and Security

### Step 45: Analytics Dashboard
- [ ] **COMPLETE**

**Task**: Create an analytics dashboard for performance tracking.
**Implementation**:
- Build analytics dashboard:
  1. **Key Performance Metrics**:
     - Implement core metrics tracking
     - Create metric visualization
     - Set up comparison tools

  2. **Conversion Tracking**:
     - Implement funnel visualization
     - Create conversion rate analysis
     - Set up attribution tracking

  3. **Campaign Performance**:
     - Implement campaign metrics
     - Create performance comparison
     - Set up trend analysis

  4. **Custom Reports**:
     - Implement report builder
     - Create export functionality
     - Set up scheduling for reports

**Deliverables**:
- Complete analytics dashboard
- Key performance metrics tracking
- Conversion and funnel visualization
- Campaign performance analysis
- Custom report builder
- PostHog integration for analytics
- Tests for analytics functionality

**Checkpoint Test**: Verify analytics dashboard with test data.
```bash
npm run test:analytics
```
**Commit Message**: "Create analytics dashboard for performance tracking"

### Step 46: A/B Testing Framework
- [ ] **COMPLETE**

**Task**: Implement A/B testing for email campaigns.
**Implementation**:
- Create A/B testing framework:
  1. **Variant Management**:
     - Implement test variant creation
     - Create variant assignment
     - Set up sampling controls

  2. **Performance Comparison**:
     - Implement statistical analysis
     - Create visualization of results
     - Set up significance testing

  3. **Automatic Optimization**:
     - Implement winner selection
     - Create automatic allocation
     - Set up continuous testing

  4. **Test Reporting**:
     - Implement test results reporting
     - Create insights generation
     - Set up recommendation engine

**Deliverables**:
- Complete A/B testing framework
- Variant management system
- Performance comparison tools
- Automatic optimization
- Test reporting and insights
- Tests for A/B testing functionality

**Checkpoint Test**: Verify A/B testing framework.
```bash
npm run test:ab-testing
```
**Commit Message**: "Implement A/B testing for email campaigns"

### Step 47: Security Enhancements
- [ ] **COMPLETE**

**Task**: Add security features for data protection.
**Implementation**:
- Implement data encryption and access controls:
  1. **Data Encryption**:
     - Implement Supabase Row Level Security (RLS) policies
     - Create encryption for sensitive data
     - Set up secure data transmission

  2. **Access Controls**:
     - Implement Supabase Auth permissions
     - Create role-based access control
     - Set up fine-grained permissions

  3. **Audit Logging**:
     - Implement comprehensive audit trails
     - Create user action logging
     - Set up security event monitoring

  4. **Security Configuration**:
     - Implement secure session management
     - Create security headers configuration
     - Set up CORS and CSP policies

**Deliverables**:
- Complete security enhancements
- Data encryption implementation
- Access control system
- Audit logging and monitoring
- Security configuration and headers
- Tests for security functionality

**Checkpoint Test**: Verify security features.
```bash
npm run test:security
```
**Commit Message**: "Add security features for data protection"

### Step 48: Compliance System
- [ ] **COMPLETE**

**Task**: Implement email compliance and anti-spam measures.
**Implementation**:
- Create compliance system:
  1. **Unsubscribe Handling**:
     - Implement unsubscribe link generation
     - Create unsubscribe processing
     - Set up preference management

  2. **CAN-SPAM Compliance**:
     - Implement required elements checking
     - Create compliance validation
     - Set up geographical restrictions

  3. **Compliance Reporting**:
     - Implement compliance status tracking
     - Create violation detection
     - Set up remediation suggestions

  4. **Content Filtering**:
     - Implement spam content detection
     - Create prohibited content checking
     - Set up content approval workflow

**Deliverables**:
- Complete compliance system
- Unsubscribe functionality
- CAN-SPAM compliance validation
- Compliance reporting and tracking
- Content filtering and approval
- Tests for compliance functionality

**Checkpoint Test**: Verify compliance features.
```bash
npm run test:compliance
```
**Commit Message**: "Implement email compliance and anti-spam measures"

### Step 49: System Monitoring
- [ ] **COMPLETE**

**Task**: Create system monitoring and alerting.
**Implementation**:
- Implement system monitoring:
  1. **Error Tracking**:
     - Implement error detection and logging
     - Create error classification
     - Set up error resolution tracking

  2. **Performance Monitoring**:
     - Implement API and database monitoring
     - Create performance metrics tracking
     - Set up bottleneck detection

  3. **Alerting System**:
     - Implement alert generation
     - Create notification routing
     - Set up escalation policies

  4. **System Health**:
     - Implement health checks
     - Create resource utilization tracking
     - Set up availability monitoring

**Deliverables**:
- Complete system monitoring
- Error tracking and logging
- Performance monitoring
- Alerting and notification system
- System health checks
- Tests for monitoring functionality

**Checkpoint Test**: Verify system monitoring features.
```bash
npm run test:monitoring
```
**Commit Message**: "Create system monitoring and alerting"

### Phase 10 Integration Test
**Task**: Verify analytics, security, and optimization features.
**Test Steps**:
1. Test analytics dashboard with sample data
2. Verify A/B testing framework
3. Test security features with penetration attempts
4. Confirm compliance and monitoring systems

**Success Criteria**:
- Analytics dashboard shows accurate metrics
- A/B testing framework correctly measures performance
- Security features protect against unauthorized access
- Compliance system ensures email legal requirements
- Monitoring system detects and alerts on issues
- All systems work together cohesively

```bash
npm run test:phase10
```
**Commit Message**: "Complete Phase 10: Analytics, Optimization, and Security"

## Final System Test

### Complete End-to-End System Test
**Task**: Verify the entire system works as expected in an integrated fashion.
**Test Steps**:
1. Run a complete campaign from business input to email sending
2. Test the autonomous mode with monitoring
3. Verify analytics reporting on campaign results
4. Confirm all security and compliance features

**Success Criteria**:
- User can input business description and generate search queries
- System finds and researches potential leads
- Personalized emails are generated and sent
- Responses are detected and handled appropriately
- Analytics show campaign performance
- Security features protect user data
- Compliance features ensure legal requirements
- System operates autonomously within defined parameters

```bash
npm run test:system
```
**Commit Message**: "Complete Cold Outreach Automation System v1.0"

## Instructions for AI Developer

1. Follow this plan sequentially, completing each step before moving to the next.
2. Run the specified checkpoint test after completing each step.
3. Only commit code once the test passes successfully.
4. Use the provided commit message format.
5. Document any issues encountered in a separate file called `implementation_notes.md`.
6. If a test fails repeatedly, document the issue and move to the next step.
7. At the end of each phase, conduct an integration test to ensure all components work together.
8. Report overall progress in the implementation_notes.md file.
9. **Update the progress tracking section at the top of this file after completing each step.**
10. **Update the phase progress indicators when all steps in a phase are complete.**

## Test Suite Setup

Before beginning implementation, set up the test suite with the following:

```bash
# Create test script
npm set-script test:all "jest --runInBand"

# Create individual test scripts for each checkpoint
# Example:
npm set-script test:auth "jest auth.test.ts"
npm set-script test:api "jest api.test.ts"
# Continue for all test steps
```

Good luck with the implementation! 