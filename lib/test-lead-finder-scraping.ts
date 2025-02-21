"use server"

import { searchAndScrape } from "../lib/search-and-scrape"
import { db } from "../db/db"
import { businessProfilesTable } from "../db/schema"
import { eq } from "drizzle-orm"
import { setSearchFunction } from "../lib/search"
import { setMockScrapeFunction, BusinessInfo } from "../lib/test-scrape-system"
import { clearProcessedUrls } from "../lib/search-utils"

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

// Additional test cases
const ERROR_TEST_WEBSITE = "https://error-example.com"
const RATE_LIMIT_WEBSITE = "https://rate-limit-example.com"
const QUOTA_EXCEEDED_WEBSITE = "https://quota-exceeded-example.com"

// Additional mock data for error testing
const MOCK_ERROR_SEARCH_RESULTS = [
  {
    url: ERROR_TEST_WEBSITE,
    title: "Error Test Site",
    description: "Site that should trigger errors"
  },
  {
    url: RATE_LIMIT_WEBSITE,
    title: "Rate Limit Test",
    description: "Site that should trigger rate limiting"
  },
  {
    url: QUOTA_EXCEEDED_WEBSITE,
    title: "Quota Test",
    description: "Site that should trigger quota exceeded"
  }
]

// Enhanced mock scrape function
const mockScrapeUrl = async (url: string): Promise<BusinessInfo> => {
  return {
    name: "Test Business",
    description: "A test business description",
    email: "test@example.com",
    phone: "123-456-7890",
    address: "123 Test St",
    services: ["Service 1", "Service 2"],
    specialties: ["Specialty 1", "Specialty 2"],
    insurances: ["Insurance 1", "Insurance 2"],
    affiliations: ["Affiliation 1", "Affiliation 2"],
    socialLinks: {
      facebook: "https://facebook.com/test",
      linkedin: "https://linkedin.com/test"
    },
    // Initialize other required fields
    title: "",
    city: "",
    state: "",
    zip: "",
    teamMembers: [],
    companyHistory: [],
    coreValues: [],
    awards: [],
    communityInvolvement: [],
    charityWork: [],
    hours: [],
    procedures: [],
    education: [],
    certifications: [],
    technologies: [],
    methodologies: [],
    testimonials: [],
    caseStudies: [],
    blogPosts: [],
    languages: [],
    paymentMethods: [],
    securityCertifications: [],
    industrySpecificInfo: {},
    alternativeContacts: [],
    otherLocations: [],
    scrapedPages: [],
    rawContent: {},
    industryFocus: [],
    competitors: [],
    customerBase: [],
    growthMetrics: {
      employeeCount: "",
      revenue: "",
      marketShare: "",
      yearOverYearGrowth: ""
    },
    pricing: {
      model: "",
      ranges: [],
      packages: []
    },
    complianceInfo: {
      standards: [],
      certifications: [],
      lastAudit: ""
    }
  };
}

// Enhanced mock search function
const mockSearchBusinesses = async (query: string, onProgress?: (type: string, data: any) => void) => {
  onProgress?.("searchStart", { query })
  
  // Test normal results
  for (const result of MOCK_SEARCH_RESULTS) {
    onProgress?.("searchResult", result)
  }
  
  // Test error cases
  for (const result of MOCK_ERROR_SEARCH_RESULTS) {
    onProgress?.("searchResult", result)
  }
  
  onProgress?.("searchComplete", {
    query,
    count: MOCK_SEARCH_RESULTS.length + MOCK_ERROR_SEARCH_RESULTS.length,
    results: [...MOCK_SEARCH_RESULTS, ...MOCK_ERROR_SEARCH_RESULTS]
  })
  
  return [...MOCK_SEARCH_RESULTS, ...MOCK_ERROR_SEARCH_RESULTS]
}

async function testLeadFinderScraping() {
  console.log("Starting test for lead finder scraping...")
  
  // Track test results
  const testResults = {
    successfulScrapes: 0,
    failedScrapes: 0,
    rateLimitErrors: 0,
    quotaErrors: 0,
    otherErrors: 0
  }
  
  // Track progress events
  const progressEvents: any[] = []
  
  // Set up mocks
  setSearchFunction(mockSearchBusinesses)
  setMockScrapeFunction(mockScrapeUrl)
  clearProcessedUrls()

  try {
    // Clean up any existing test data
    await db.delete(businessProfilesTable)
      .where(eq(businessProfilesTable.websiteUrl, TEST_WEBSITE))
    
    // Test successful scraping
    console.log("\nTesting successful scraping...")
    const result = await searchAndScrape(
      "dentists in Austin",
      (progress) => {
        progressEvents.push(progress)
        console.log("Progress:", progress)
        
        // Track results
        if (progress.type === "scrapeComplete") {
          testResults.successfulScrapes++
        } else if (progress.type === "scrapeError") {
          if (progress.error?.message?.includes("Rate limit")) {
            testResults.rateLimitErrors++
          } else if (progress.error?.message?.includes("quota")) {
            testResults.quotaErrors++
          } else {
            testResults.otherErrors++
          }
          testResults.failedScrapes++
        }
      },
      (error) => {
        console.error("Error:", error)
        // Errors are already tracked in the progress handler
      }
    )

    // Verify successful scraping
    const profile = await db.query.businessProfiles.findFirst({
      where: eq(businessProfilesTable.websiteUrl, TEST_WEBSITE)
    })

    if (!profile) {
      throw new Error("Test failed: Profile not created")
    }

    // Verify profile data
    if (profile.businessName !== TEST_BUSINESS_INFO.name) {
      throw new Error(`Business name mismatch. Expected: "${TEST_BUSINESS_INFO.name}", Got: "${profile.businessName}"`)
    }

    if (profile.primaryEmail !== TEST_BUSINESS_INFO.email) {
      throw new Error(`Email mismatch. Expected: "${TEST_BUSINESS_INFO.email}", Got: "${profile.primaryEmail}"`)
    }

    // Verify error handling
    console.log("\nVerifying error handling...")
    if (testResults.failedScrapes !== 3) {
      throw new Error(`Expected 3 failed scrapes, got ${testResults.failedScrapes}`)
    }
    if (testResults.rateLimitErrors !== 1) {
      throw new Error(`Expected 1 rate limit error, got ${testResults.rateLimitErrors}`)
    }
    if (testResults.quotaErrors !== 1) {
      throw new Error(`Expected 1 quota error, got ${testResults.quotaErrors}`)
    }
    if (testResults.otherErrors !== 1) {
      throw new Error(`Expected 1 other error, got ${testResults.otherErrors}`)
    }

    // Log success
    console.log("\nTest Results:", testResults)
    console.log("\nProgress Events:", progressEvents)
    console.log("\nCreated Profile:", profile)
    console.log("\n✅ All tests passed successfully!")

  } catch (error) {
    console.error("\n❌ Test failed with error:", error)
    throw error
  } finally {
    // Clean up test data
    await db.delete(businessProfilesTable)
      .where(eq(businessProfilesTable.websiteUrl, TEST_WEBSITE))
    
    // Reset mocks
    setSearchFunction(null)
    setMockScrapeFunction(null)
  }
}

// Run the test
if (require.main === module) {
  testLeadFinderScraping()
} 