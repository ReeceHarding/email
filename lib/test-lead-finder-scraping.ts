"use server"

import { searchAndScrape } from "@/lib/search-and-scrape"
import { db } from "@/db/db"
import { businessProfilesTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { setSearchFunction } from "@/lib/search"
import { setScrapeFunction } from "@/lib/test-scrape-system"
import { clearProcessedUrls } from "@/lib/search-utils"

// Mock test data
const TEST_WEBSITE = "https://example-dentist.com"
const TEST_BUSINESS_INFO = {
  name: "Example Dental Practice",
  description: "A leading dental practice in Austin, Texas",
  email: "contact@example-dentist.com",
  phone: "(512) 555-0123",
  address: "123 Main St, Austin, TX 78701",
  services: [
    "General Dentistry",
    "Cosmetic Dentistry",
    "Emergency Dental Care"
  ],
  specialties: [
    "Invisalign",
    "Dental Implants",
    "Root Canal Treatment"
  ],
  insurances: [
    "Delta Dental",
    "Cigna",
    "Aetna"
  ],
  affiliations: [
    "American Dental Association",
    "Texas Dental Association"
  ],
  socialLinks: {
    facebook: "https://facebook.com/example-dentist",
    linkedin: "https://linkedin.com/company/example-dentist"
  }
}

// Mock search results
const MOCK_SEARCH_RESULTS = [
  {
    url: TEST_WEBSITE,
    title: TEST_BUSINESS_INFO.name,
    description: TEST_BUSINESS_INFO.description
  }
]

// Mock search function
const mockSearchBusinesses = async (query: string, onProgress?: (type: string, data: any) => void) => {
  onProgress?.("searchStart", { query })
  for (const result of MOCK_SEARCH_RESULTS) {
    onProgress?.("searchResult", result)
  }
  onProgress?.("searchComplete", {
    query,
    count: MOCK_SEARCH_RESULTS.length,
    results: MOCK_SEARCH_RESULTS
  })
  return MOCK_SEARCH_RESULTS
}

// Mock scrape function
const mockScrapeUrl = async (url: string) => {
  if (url === TEST_WEBSITE) {
    return TEST_BUSINESS_INFO
  }
  return null
}

async function testLeadFinderScraping() {
  console.log("Starting test for lead finder scraping...")

  // Set up mocks
  setSearchFunction(mockSearchBusinesses)
  setScrapeFunction(mockScrapeUrl)

  // Test case 1: Basic scraping
  const query = "dentists in Austin Texas"
  console.log("\nTesting scraping with query:", query)

  let progressEvents: any[] = []
  let errorEvents: any[] = []

  try {
    // Clean up any existing test data
    await db.delete(businessProfilesTable)
      .where(eq(businessProfilesTable.websiteUrl, TEST_WEBSITE))
    await db.delete(businessProfilesTable)
      .where(eq(businessProfilesTable.businessName, TEST_BUSINESS_INFO.name))
    
    // Clear processed URLs
    await clearProcessedUrls()

    // Run the search and scrape process
    await searchAndScrape(
      query,
      (data) => {
        console.log("Progress:", data)
        progressEvents.push(data)
      },
      (error) => {
        console.error("Error:", error)
        errorEvents.push(error)
      }
    )

    // Verify progress events
    if (progressEvents.length === 0) {
      console.error("Test failed: No progress events received")
      process.exit(1)
    }

    // Verify expected event types
    const expectedEventTypes = [
      "searchStart",
      "searchResult",
      "searchComplete",
      "url",  // This is the business profile creation event
    ]

    for (const type of expectedEventTypes) {
      if (!progressEvents.some(e => e.type === type || (type === "url" && e.url))) {
        console.error(`Test failed: Missing "${type}" event`)
        process.exit(1)
      }
    }

    // Verify business profile was created
    const profile = await db.query.businessProfiles.findFirst({
      where: eq(businessProfilesTable.websiteUrl, TEST_WEBSITE)
    })

    if (!profile) {
      console.error("Test failed: Business profile not created")
      process.exit(1)
    }

    // Verify profile data
    if (profile.businessName !== TEST_BUSINESS_INFO.name) {
      console.error("Test failed: Business name mismatch")
      console.error(`Expected: "${TEST_BUSINESS_INFO.name}"`)
      console.error(`Got: "${profile.businessName}"`)
      process.exit(1)
    }

    if (profile.primaryEmail !== TEST_BUSINESS_INFO.email) {
      console.error("Test failed: Email mismatch")
      console.error(`Expected: "${TEST_BUSINESS_INFO.email}"`)
      console.error(`Got: "${profile.primaryEmail}"`)
      process.exit(1)
    }

    // Log success
    console.log("\nTest passed: Lead finder scraping works correctly")
    console.log("\nProgress events:", progressEvents)
    console.log("\nCreated profile:", profile)

  } catch (error) {
    console.error("Test failed with error:", error)
    process.exit(1)
  } finally {
    // Clean up test data
    await db.delete(businessProfilesTable)
      .where(eq(businessProfilesTable.websiteUrl, TEST_WEBSITE))
    await db.delete(businessProfilesTable)
      .where(eq(businessProfilesTable.businessName, TEST_BUSINESS_INFO.name))

    // Reset mocks
    setSearchFunction(null)
    setScrapeFunction(null)
  }
}

// Run the test
if (require.main === module) {
  testLeadFinderScraping()
} 