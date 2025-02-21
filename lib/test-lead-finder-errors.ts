import { setSearchFunction } from "@/lib/search-utils"
import { searchAndScrape } from "@/lib/search-and-scrape"
import { setScrapeFunction } from "@/lib/test-scrape-system"
import { setOpenAI } from "@/actions/generate-search-queries"

// Mock OpenAI for query generation
const mockOpenAI = {
  chat: {
    completions: {
      create: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              queries: [
                "dentists in Austin Texas"
              ]
            })
          }
        }]
      })
    }
  }
}

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
  const error: any = new Error("Network error: Failed to connect to search API")
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
  setScrapeFunction(mockScrapeWithBlockedAccess)

  let progressEvents: any[] = []
  let errorEvents: any[] = []

  try {
    await searchAndScrape(
      "dentists in Austin Texas",
      (data) => progressEvents.push(data),
      (error) => errorEvents.push(error)
    )
  } catch (error) {
    // Expected to throw
    if (!errorEvents.some(e => e.message?.includes("429"))) {
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
    await searchAndScrape(
      "dentists in Austin Texas",
      (data) => progressEvents.push(data),
      (error) => errorEvents.push(error)
    )
  } catch (error) {
    // Expected to throw
    if (!errorEvents.some(e => e.message?.includes("429"))) {
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
    await searchAndScrape(
      "dentists in Austin Texas",
      (data) => progressEvents.push(data),
      (error) => errorEvents.push(error)
    )
  } catch (error) {
    // Expected to throw
    if (!errorEvents.some(e => e.message?.includes("ECONNREFUSED"))) {
      console.error("Test failed: Network error not handled correctly")
      process.exit(1)
    }
  }

  // Test scraping error
  console.log("\nTesting scraping error...")
  setSearchFunction(() => Promise.resolve([{ url: "https://example.com", title: "Example", description: "Test" }]))
  setScrapeFunction(mockScrapeWithBlockedAccess)
  progressEvents = []
  errorEvents = []

  try {
    await searchAndScrape(
      "dentists in Austin Texas",
      (data) => progressEvents.push(data),
      (error) => errorEvents.push(error)
    )
  } catch (error) {
    // Expected to throw
    if (!errorEvents.some(e => e.message?.includes("Access denied"))) {
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