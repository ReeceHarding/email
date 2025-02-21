import { GET } from "@/app/api/auth/gmail/route"
import { db } from "@/db/db"
import { usersTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { NextRequest } from "next/server"
import { google } from "googleapis"

// Mock the googleapis module
const originalOAuth2 = google.auth.OAuth2
google.auth.OAuth2 = function() {
  return {
    getToken: async () => {
      throw new Error("Invalid authorization code")
    }
  }
} as any

const TEST_USER = {
  clerkId: "test_user_123",
  email: "test@example.com"
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

async function testInvalidExchange() {
  try {
    // Create test user first
    await setupTestUser()

    // Test request with invalid code
    const req = new NextRequest(
      new Request("http://localhost:3002/api/auth/gmail?code=invalid_code&state=" + TEST_USER.clerkId)
    )
    const res = await GET(req)
    const json = await res.json()

    // Verify response
    if (
      json.error === "Failed to exchange authorization code for tokens" &&
      res.status === 500
    ) {
      console.log("Test passed: Invalid exchange error handled correctly")
      console.log("Response:", json)
      return true
    } else {
      console.log("Test failed: Unexpected response")
      console.log("Response:", json)
      return false
    }
  } catch (error) {
    console.error("Test failed with error:", error)
    return false
  } finally {
    // Restore original OAuth2 implementation
    google.auth.OAuth2 = originalOAuth2

    // Clean up test user
    await db.delete(usersTable)
      .where(eq(usersTable.clerkId, TEST_USER.clerkId))
  }
}

if (require.main === module) {
  testInvalidExchange()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error("Test failed:", error)
      process.exit(1)
    })
} 