import { db } from "@/db/db"
import { usersTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { recordLeadUsage } from "./stripe"

const TEST_USER = {
  clerkId: "test_user_123",
  email: "test@example.com",
  // Intentionally omitting stripeSubscriptionId
  stripeSubscriptionId: null
}

async function setupTestUser() {
  try {
    // Delete existing test user if any
    await db.delete(usersTable)
      .where(eq(usersTable.clerkId, TEST_USER.clerkId))

    // Create new test user
    const [user] = await db.insert(usersTable)
      .values(TEST_USER)
      .returning()

    console.log("Test user created:", user)
    return user
  } catch (error) {
    console.error("Error setting up test user:", error)
    throw error
  }
}

async function testRecordLeadUsageMissingSubscription() {
  try {
    // Create test user first
    await setupTestUser()

    try {
      // Attempt to record usage (should fail)
      await recordLeadUsage(TEST_USER.clerkId)

      console.log("Test failed: Expected error was not thrown")
      return false
    } catch (error) {
      // Verify error message
      if (error instanceof Error && error.message === "User missing stripeSubscriptionId or not found.") {
        console.log("Test passed: Missing subscription error handled correctly")
        console.log("Error:", error.message)
        return true
      } else {
        console.log("Test failed: Unexpected error message")
        console.log("Error:", error)
        return false
      }
    }
  } catch (error) {
    console.error("Test failed with error:", error)
    return false
  } finally {
    // Clean up test user
    await db.delete(usersTable)
      .where(eq(usersTable.clerkId, TEST_USER.clerkId))
  }
}

if (require.main === module) {
  testRecordLeadUsageMissingSubscription()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error("Test failed:", error)
      process.exit(1)
    })
} 