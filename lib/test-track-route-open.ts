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

async function testTrackOpen() {
  try {
    // Create test lead first
    const lead = await setupTestLead()

    // Create track request for open event
    const req = new NextRequest(
      new Request(`http://localhost:3002/api/track?leadId=${lead.id}&type=open`)
    )

    // Process request
    const res = await GET(req)

    // Verify response
    if (res.status === 200) {
      // Check content type
      const contentType = res.headers.get("Content-Type")
      if (contentType !== "image/gif") {
        console.log("Test failed: Wrong content type")
        console.log("Expected: image/gif")
        console.log("Got:", contentType)
        return false
      }

      // Verify database update
      const updatedLead = await db.query.leads.findFirst({
        where: eq(leadsTable.id, lead.id)
      })

      if (updatedLead?.status === "opened") {
        console.log("Test passed: Open event handled correctly")
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
  testTrackOpen()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error("Test failed:", error)
      process.exit(1)
    })
} 