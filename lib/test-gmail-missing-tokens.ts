import { db } from "@/db/db"
import { usersTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { sendGmail } from "./google"

const TEST_USER = {
  clerkId: "test_user_123",
  email: "test@example.com",
  // Intentionally omitting Gmail tokens
  gmailAccessToken: null,
  gmailRefreshToken: null
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

async function testSendGmailMissingTokens() {
  try {
    // Create test user first
    await setupTestUser()

    try {
      // Attempt to send an email (should fail)
      await sendGmail({
        userClerkId: TEST_USER.clerkId,
        to: "recipient@example.com",
        subject: "Test Email",
        body: "<p>This is a test email.</p>"
      })

      console.log("Test failed: Expected error was not thrown")
      return false
    } catch (error) {
      // Verify error message
      if (error instanceof Error && error.message === "User has not connected their Gmail account yet.") {
        console.log("Test passed: Missing tokens error handled correctly")
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
  testSendGmailMissingTokens()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error("Test failed:", error)
      process.exit(1)
    })
} 