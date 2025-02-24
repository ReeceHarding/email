"use server"

import { setSearchFunction } from "@/lib/search-utils"
import { searchBusinessesWithBrave } from "@/lib/search-and-scrape"
import { setMockScrapeFunction } from "@/lib/test-scrape-system"
import { setOpenAI } from "@/actions/generate-search-queries"
import { OpenAI } from "openai"

interface ProgressEvent {
  type: string;
  message: string;
  data?: Record<string, unknown>;
}

interface ErrorEvent {
  type: string;
  message: string;
  error?: Error;
}

// Mock OpenAI for query generation
const mockOpenAI = {
  chat: {
    completions: {
      create: () => {
        const response = {
          id: 'mock-completion-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                queries: [
                  "dentists in Austin Texas"
                ]
              })
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          }
        };

        // Create a promise that resolves with the response
        const promise = Promise.resolve(response);

        // Add the required APIPromise properties
        return Object.assign(promise, {
          responsePromise: Promise.resolve(response),
          parseResponse: () => Promise.resolve(response),
          parsedPromise: Promise.resolve(response),
          _thenUnwrap: (fn: any) => promise.then(fn)
        });
      }
    }
  }
} as unknown as OpenAI;

// Mock search function that simulates rate limiting
const mockSearchWithRateLimit = async () => {
  throw {
    response: {
      status: 429,
      data: {
        type: "ErrorResponse",
        error: {
          meta: {
            quota_current: 1000
          }
        },
        time: Date.now()
      }
    }
  }
}

// Mock search function that simulates quota exceeded
const mockSearchWithQuotaExceeded = async () => {
  throw {
    response: {
      status: 429,
      data: {
        type: "ErrorResponse",
        error: {
          meta: {
            quota_current: 2000
          }
        },
        time: Date.now()
      }
    }
  }
}

// Mock search function that simulates network error
const mockSearchWithNetworkError = async () => {
  const error = new Error("Network error: Failed to connect to search API") as Error & {
    name: string;
    code: string;
  }
  error.name = "AxiosError"
  error.code = "ECONNREFUSED"
  throw error
}

// Mock scrape function that simulates blocked access
const mockScrapeWithBlockedAccess = async () => {
  throw new Error("Access denied: Website blocked scraping")
}

async function testLeadFinderErrors() {
  console.log("Starting test for lead finder error handling...")

  // Set up mocks
  setOpenAI(mockOpenAI)

  // Test rate limiting error
  console.log("\nTesting rate limiting error...")
  setSearchFunction(mockSearchWithRateLimit)
  setMockScrapeFunction(mockScrapeWithBlockedAccess)

  let progressEvents: ProgressEvent[] = []
  let errorEvents: ErrorEvent[] = []

  try {
    await searchBusinessesWithBrave("dentists in Austin Texas")
  } catch (error) {
    // Expected to throw
    if (!error || !(error instanceof Error) || !error.message.includes("429")) {
      console.error("Test failed: Rate limiting error not handled correctly")
      process.exit(1)
    }
  }

  // Test quota exceeded error
  console.log("\nTesting quota exceeded error...")
  setSearchFunction(mockSearchWithQuotaExceeded)
  progressEvents = []
  errorEvents = []

  try {
    await searchBusinessesWithBrave("dentists in Austin Texas")
  } catch (error) {
    // Expected to throw
    if (!error || !(error instanceof Error) || !error.message.includes("429")) {
      console.error("Test failed: Quota exceeded error not handled correctly")
      process.exit(1)
    }
  }

  // Test network error
  console.log("\nTesting network error...")
  setSearchFunction(mockSearchWithNetworkError)
  progressEvents = []
  errorEvents = []

  try {
    await searchBusinessesWithBrave("dentists in Austin Texas")
  } catch (error) {
    // Expected to throw
    if (!error || !(error instanceof Error) || !error.message.includes("ECONNREFUSED")) {
      console.error("Test failed: Network error not handled correctly")
      process.exit(1)
    }
  }

  // Test scraping error
  console.log("\nTesting scraping error...")
  setSearchFunction(() => Promise.resolve([{ url: "https://example.com", title: "Example", description: "Test" }]))
  setMockScrapeFunction(mockScrapeWithBlockedAccess)
  progressEvents = []
  errorEvents = []

  try {
    await searchBusinessesWithBrave("dentists in Austin Texas")
  } catch (error) {
    // Expected to throw
    if (!error || !(error instanceof Error) || !error.message.includes("Access denied")) {
      console.error("Test failed: Scraping error not handled correctly")
      process.exit(1)
    }
  }

  // Log success
  console.log("\nTest passed: Lead finder error handling works correctly")
  console.log("\nError events:", errorEvents)
}

// Run the test
testLeadFinderErrors().catch(console.error) 