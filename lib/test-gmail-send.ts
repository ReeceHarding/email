import { db } from "@/db/db"
import { usersTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { google } from "googleapis"
import { sendGmail } from "./google"

// Mock the googleapis module
const originalGmail = google.gmail
google.gmail = () => ({
  users: {
    messages: {
      send: async () => ({
        data: {
          threadId: "test_thread_123",
          id: "test_message_123"
        }
      })
    }
  }
}) as any

const TEST_USER = {
  clerkId: "test_user_123",
  email: "test@example.com",
  gmailAccessToken: "test_access_token",
  gmailRefreshToken: "test_refresh_token"
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

async function testSendGmail() {
  try {
    // Create test user first
    await setupTestUser()

    // Test sending an email
    const result = await sendGmail({
      userClerkId: TEST_USER.clerkId,
      to: "recipient@example.com",
      subject: "Test Email",
      body: "<p>This is a test email.</p>"
    })

    // Verify response
    if (
      result.threadId === "test_thread_123" &&
      result.messageId === "test_message_123"
    ) {
      console.log("Test passed: Email sent successfully")
      console.log("Response:", result)
      return true
    } else {
      console.log("Test failed: Unexpected response")
      console.log("Response:", result)
      return false
    }
  } catch (error) {
    console.error("Test failed with error:", error)
    return false
  } finally {
    // Restore original Gmail implementation
    google.gmail = originalGmail

    // Clean up test user
    await db.delete(usersTable)
      .where(eq(usersTable.clerkId, TEST_USER.clerkId))
  }
}

if (require.main === module) {
  testSendGmail()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error("Test failed:", error)
      process.exit(1)
    })
} 