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
  userId: "test_user_123",
  name: "Test User",
  email: "test@example.com",
  gmailAccessToken: "test_access_token",
  gmailRefreshToken: "test_refresh_token"
}

async function setupTestUser() {
  try {
    // Delete any existing test user
    await db.delete(usersTable)
      .where(eq(usersTable.userId, TEST_USER.userId))
    
    // Create test user
    await db.insert(usersTable)
      .values(TEST_USER)

    console.log("Test user created")
  } catch (error) {
    console.error("Error setting up test user:", error)
  }
}

async function testSendGmail() {
  try {
    // Create test user first
    await setupTestUser()

    // Test sending an email
    const result = await sendGmail({
      userId: TEST_USER.userId,
      to: "recipient@example.com",
      subject: "Test Email",
      body: "<p>This is a test email.</p>"
    })

    // Verify response
    if (
      result.threadId === "test_thread_123" &&
      result.messageId === "test_message_123"
    ) {
      console.log("✅ Email sent successfully!")
    } else {
      console.error("❌ Unexpected response:", result)
    }
  } catch (error) {
    console.error("❌ Error sending email:", error)
  } finally {
    // Clean up test user
    await db.delete(usersTable)
      .where(eq(usersTable.userId, TEST_USER.userId))
    
    // Restore original Gmail implementation
    google.gmail = originalGmail
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