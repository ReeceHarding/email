# Search and Scrape System Documentation

This document explains how to use the enhanced search and scrape system for lead generation.

## Overview

The search and scrape system provides an end-to-end solution for:

1. Generating targeted search queries based on business criteria
2. Finding relevant business websites via search APIs
3. Scraping business information from these websites
4. Identifying and researching team members/decision-makers
5. Generating personalized email content for outreach
6. Storing all data for use in the dashboard

## Components

The system consists of several modular components:

### 1. Search Service (`lib/search-service.ts`)

Handles web searches using the Brave Search API, with fallback mechanisms for when the API is unavailable.

### 2. Enhanced Scraper (`lib/enhanced-scraper.ts`)

Extracts structured business data from websites using multiple strategies:
- Puppeteer for dynamic content
- Static HTML parsing with Cheerio
- Integration with Firecrawl API when available

### 3. Contact Research (`lib/contact-research.ts`)

Enriches team member data with detailed contact information and professional background. Uses web searches and AI to build comprehensive profiles.

### 4. Content Generation (`lib/content-generation.ts`)

Creates personalized email content based on the business and contact research. Includes template selection, variable substitution, and AI enhancement.

### 5. Email Service (`lib/email-service.ts`)

Handles email sending through Gmail API integration, managing authentication, tokens, and message creation.

### 6. Scrape Controller (`lib/scrape-controller.ts`)

Orchestrates the entire process and manages the workflow between components.

### 7. Server Actions (`actions/search-scrape-actions.ts`)

Exposes functionality to the frontend with authentication and progress tracking.

## Usage

### Starting a Scrape Process

You can trigger the scrape process from any client component:

```tsx
"use client"

import { startScrapeProcessAction, getScrapeProgressAction, formatProgress } from "@/actions/search-scrape-actions";
import { useState, useEffect } from "react";

export default function LeadGenerationPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  
  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    
    const criteria = {
      businessType: formData.get("businessType") as string,
      location: formData.get("location") as string,
      industry: formData.get("industry") as string,
      maxResults: parseInt(formData.get("maxResults") as string) || 5
    };
    
    const result = await startScrapeProcessAction(criteria);
    
    if (result.isSuccess) {
      // Start polling for progress
      startProgressPolling();
    } else {
      alert(result.message);
      setIsLoading(false);
    }
  }
  
  function startProgressPolling() {
    const interval = setInterval(async () => {
      const progressResult = await getScrapeProgressAction();
      
      if (progressResult.isSuccess && progressResult.data) {
        setProgress(progressResult.data);
        
        // Stop polling when completed or failed
        if (
          progressResult.data.status === "completed" || 
          progressResult.data.status === "failed"
        ) {
          clearInterval(interval);
          setIsLoading(false);
        }
      }
    }, 2000); // Poll every 2 seconds
    
    // Cleanup on unmount
    return () => clearInterval(interval);
  }
  
  // Format progress for display
  const formattedProgress = progress ? formatProgress(progress) : null;
  
  return (
    <div>
      <h1>Generate Leads</h1>
      
      <form onSubmit={handleSubmit}>
        <div>
          <label>Business Type</label>
          <input name="businessType" required />
        </div>
        
        <div>
          <label>Location</label>
          <input name="location" />
        </div>
        
        <div>
          <label>Industry</label>
          <input name="industry" />
        </div>
        
        <div>
          <label>Max Results</label>
          <input name="maxResults" type="number" defaultValue="5" />
        </div>
        
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Processing..." : "Generate Leads"}
        </button>
      </form>
      
      {formattedProgress && (
        <div>
          <h2>Progress: {formattedProgress.completion}%</h2>
          <p>{formattedProgress.processingStep}</p>
          {formattedProgress.detail && <p>Currently processing: {formattedProgress.detail}</p>}
          {formattedProgress.error && <p className="error">Error: {formattedProgress.error}</p>}
        </div>
      )}
    </div>
  );
}
```

## Configuration

The system uses several environment variables:

```
# Search Service Configuration
BRAVE_API_KEY=your-brave-api-key

# Scraping Configuration
FIRECRAWL_API_KEY=your-firecrawl-api-key

# OpenAI API Key for AI Features
OPENAI_API_KEY=your-openai-api-key
```

## Data Structure

### Business Data

The primary data structure for business information:

```typescript
interface BusinessData {
  name: string;
  description?: string;
  website: string;
  address?: string;
  phone?: string;
  email?: string;
  hours?: string[];
  services?: Array<{
    name: string;
    description?: string;
    price?: string;
  }>;
  teamMembers?: TeamMember[];
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    youtube?: string;
    [key: string]: string | undefined;
  };
  certifications?: string[];
  specialties?: string[];
  companyValues?: string[];
  industries?: string[];
}
```

### Team Member Data

Information about individuals within a business:

```typescript
interface TeamMember {
  name: string;
  title?: string;
  email?: string;
  linkedin?: string;
  bio?: string;
}

interface EnrichedTeamMember extends TeamMember {
  contactInfo?: ContactInfo;
  researchSummary?: string;
}
```

### Email Content

Structure for generated email content:

```typescript
interface GeneratedEmail {
  subject: string;
  body: string;
  recipientEmail?: string;
  recipientName?: string;
  variables: EmailVariables;
}
```

## Architecture Diagram

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  Frontend UI  │────▶│ Server Action │────▶│Scrape Process │
│ (React/Next)  │◀────│   (Actions)   │◀────│ (Background)  │
└───────────────┘     └───────────────┘     └───────────────┘
                                                   │
                                                   ▼
┌────────────────────────────────────────────────────────────┐
│                     Scrape Controller                       │
└────────────────────────────────────────────────────────────┘
          │              │               │              │
          ▼              ▼               ▼              ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│    Search   │  │  Enhanced   │  │   Contact   │  │   Content   │
│   Service   │  │   Scraper   │  │  Research   │  │ Generation  │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
       │                │                │                │
       │                │                │                │
       ▼                ▼                ▼                ▼
┌────────────────────────────────────────────────────────────┐
│                      Database Layer                         │
└────────────────────────────────────────────────────────────┘
```

## Best Practices

1. **Rate Limiting**: The system includes built-in delays between requests to avoid rate limiting by search engines and websites.

2. **Error Handling**: Each component has robust error handling to ensure the process continues even if individual steps fail.

3. **Progress Tracking**: The controller provides detailed progress information that can be displayed to users.

4. **Asynchronous Processing**: Long-running scrape processes run in the background to avoid blocking the user interface.

5. **Fallbacks**: Multiple fallback mechanisms are implemented for each stage of the process.

## Limitations

1. **Website Access**: Some websites may block scraping attempts or require CAPTCHA verification.

2. **Contact Information**: Not all businesses publicly display contact information or team member details.

3. **API Rate Limits**: External APIs like Brave Search have rate limits that may affect the number of searches possible.

4. **Processing Time**: Deep scraping can take several minutes depending on the number of websites and team members.

## Future Improvements

1. **Headless Browser Pool**: Implement a pool of headless browsers to improve scraping performance.

2. **Caching Layer**: Add caching to reduce redundant API calls and improve response times.

3. **Webhook Notifications**: Implement webhook notifications when scrape processes complete.

4. **Advanced Filtering**: Add more sophisticated filtering options for search queries and results.

5. **Scheduling**: Allow users to schedule periodic scrapes for ongoing lead generation. 