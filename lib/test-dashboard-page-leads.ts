import { db } from "@/db/db"
import { leadsTable } from "@/db/schema"
import { eq, desc } from "drizzle-orm"

const TEST_USER = {
  clerkId: "test_user_123"
}

const TEST_LEADS = [
  {
    userId: TEST_USER.clerkId,
    websiteUrl: "https://example1.com",
    companyName: "Company One",
    contactEmail: "contact1@example.com",
    status: "pending",
    createdAt: new Date("2024-02-20T00:00:00Z"),
    updatedAt: new Date("2024-02-20T00:00:00Z")
  },
  {
    userId: TEST_USER.clerkId,
    websiteUrl: "https://example2.com",
    companyName: "Company Two",
    contactEmail: "contact2@example.com",
    status: "scraped",
    createdAt: new Date("2024-02-21T00:00:00Z"),
    updatedAt: new Date("2024-02-21T00:00:00Z")
  },
  {
    userId: TEST_USER.clerkId,
    websiteUrl: "https://example3.com",
    companyName: "Company Three",
    contactEmail: "contact3@example.com",
    status: "emailed",
    createdAt: new Date("2024-02-22T00:00:00Z"),
    updatedAt: new Date("2024-02-22T00:00:00Z")
  }
]

async function setupTestLeads() {
  try {
    // Delete any existing test leads first
    await db.delete(leadsTable)
      .where(eq(leadsTable.userId, TEST_USER.clerkId))

    // Create new test leads
    const leads = await db.insert(leadsTable)
      .values(TEST_LEADS)
      .returning()

    console.log("Test leads created:", leads)
    return leads
  } catch (error) {
    console.error("Error setting up test leads:", error)
    throw error
  }
}

async function testDashboardPageLeads() {
  try {
    // Create test leads first
    await setupTestLeads()

    // Fetch leads using the same query as the dashboard page
    const userLeads = await db.select()
      .from(leadsTable)
      .where(eq(leadsTable.userId, TEST_USER.clerkId))
      .limit(50)
      .orderBy(desc(leadsTable.updatedAt))

    // Verify that all leads are present and in the correct order
    if (userLeads.length !== TEST_LEADS.length) {
      console.log("Test failed: Wrong number of leads")
      console.log("Expected:", TEST_LEADS.length)
      console.log("Got:", userLeads.length)
      return false
    }

    // Check if leads are in descending order by updatedAt
    let correctOrder = true
    let lastDate = new Date(userLeads[0].updatedAt!)

    for (let i = 1; i < userLeads.length; i++) {
      const currentDate = new Date(userLeads[i].updatedAt!)
      if (currentDate > lastDate) {
        correctOrder = false
        break
      }
      lastDate = currentDate
    }

    if (!correctOrder) {
      console.log("Test failed: Leads not in descending order")
      return false
    }

    // Verify lead data
    for (let i = 0; i < userLeads.length; i++) {
      const lead = userLeads[i]
      const testLead = TEST_LEADS[TEST_LEADS.length - 1 - i] // Reverse order since we're sorting desc

      if (
        lead.companyName !== testLead.companyName ||
        lead.contactEmail !== testLead.contactEmail ||
        lead.status !== testLead.status
      ) {
        console.log("Test failed: Lead data mismatch")
        console.log("Expected:", testLead)
        console.log("Got:", lead)
        return false
      }
    }

    console.log("Test passed: Dashboard page leads query works correctly")
    console.log("Leads retrieved in correct order:", userLeads)
    return true
  } catch (error) {
    console.error("Test failed with error:", error)
    return false
  } finally {
    // Clean up test leads
    await db.delete(leadsTable)
      .where(eq(leadsTable.userId, TEST_USER.clerkId))
  }
}

if (require.main === module) {
  testDashboardPageLeads()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error("Test failed:", error)
      process.exit(1)
    })
} 