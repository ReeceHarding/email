import { GET } from "@/app/api/track/route"
import { NextRequest } from "next/server"
import { db } from "@/db/db"
import { leadsTable } from "@/db/schema"
import { eq } from "drizzle-orm"

const TEST_LEAD = {
  userId: "test_user_123",
  websiteUrl: "https://example.com",
  status: "pending"
}

const TEST_DESTINATION_URL = "https://example.com/destination"

async function setupTestLead() {
  try {
    // Delete any existing test leads first
    await db.delete(leadsTable)
      .where(eq(leadsTable.userId, TEST_LEAD.userId))

    // Create new test lead
    const [lead] = await db.insert(leadsTable)
      .values(TEST_LEAD)
      .returning()

    console.log("Test lead created:", lead)
    return lead
  } catch (error) {
    console.error("Error setting up test lead:", error)
    throw error
  }
}

async function testTrackClick() {
  try {
    // Create test lead first
    const lead = await setupTestLead()

    // Create track request for click event
    const req = new NextRequest(
      new Request(`http://localhost:3002/api/track?leadId=${lead.id}&type=click&url=${encodeURIComponent(TEST_DESTINATION_URL)}`)
    )

    // Process request
    const res = await GET(req)

    // Verify response
    if (res.status === 307 || res.status === 308) {
      // Check redirect URL
      const redirectUrl = res.headers.get("Location")
      if (redirectUrl !== TEST_DESTINATION_URL) {
        console.log("Test failed: Wrong redirect URL")
        console.log("Expected:", TEST_DESTINATION_URL)
        console.log("Got:", redirectUrl)
        return false
      }

      // Verify database update
      const updatedLead = await db.query.leads.findFirst({
        where: eq(leadsTable.id, lead.id)
      })

      if (updatedLead?.status === "clicked") {
        console.log("Test passed: Click event handled correctly")
        console.log("Lead updated:", updatedLead)
        return true
      } else {
        console.log("Test failed: Lead status not updated")
        console.log("Lead:", updatedLead)
        return false
      }
    } else {
      console.log("Test failed: Unexpected response status")
      console.log("Status:", res.status)
      return false
    }
  } catch (error) {
    console.error("Test failed with error:", error)
    return false
  } finally {
    // Clean up test lead
    await db.delete(leadsTable)
      .where(eq(leadsTable.userId, TEST_LEAD.userId))
  }
}

if (require.main === module) {
  testTrackClick()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error("Test failed:", error)
      process.exit(1)
    })
} 