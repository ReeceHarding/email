import { GET } from "@/app/api/auth/gmail/route"
import { db } from "@/db/db"
import { usersTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { NextRequest } from "next/server"

// Mock the googleapis module
import { google } from "googleapis"

// Override the OAuth2 implementation for testing
const originalOAuth2 = google.auth.OAuth2
google.auth.OAuth2 = function() {
  return {
    getToken: async (code: string) => {
      if (code === "valid_code") {
        return {
          tokens: {
            access_token: "test_access_token",
            refresh_token: "test_refresh_token"
          }
        }
      }
      throw new Error("Invalid code")
    }
  }
} as any

const TEST_USER = {
  clerkId: "test_user_123",
  email: "test@example.com"
}

async function testGmailCallback() {
  try {
    // Test case 1: Missing code
    const reqNoCode = new NextRequest(
      new Request("http://localhost:3002/api/auth/gmail?state=" + TEST_USER.clerkId)
    )
    const resNoCode = await GET(reqNoCode)
    const noCodeJson = await resNoCode.json()
    console.log("Test case 1 (Missing code):", noCodeJson)
    
    // Test case 2: Missing state
    const reqNoState = new NextRequest(
      new Request("http://localhost:3002/api/auth/gmail?code=test_code")
    )
    const resNoState = await GET(reqNoState)
    const noStateJson = await resNoState.json()
    console.log("Test case 2 (Missing state):", noStateJson)
    
    // Test case 3: Invalid state
    const reqInvalidState = new NextRequest(
      new Request("http://localhost:3002/api/auth/gmail?code=test_code&state=invalid_user")
    )
    const resInvalidState = await GET(reqInvalidState)
    const invalidStateJson = await resInvalidState.json()
    console.log("Test case 3 (Invalid state):", invalidStateJson)
    
    // Test case 4: Happy path
    const reqValid = new NextRequest(
      new Request("http://localhost:3002/api/auth/gmail?code=valid_code&state=" + TEST_USER.clerkId)
    )
    const resValid = await GET(reqValid)
    
    if (resValid.headers.get("location")?.includes("/dashboard")) {
      console.log("Test case 4 (Happy path): Success - Redirected to dashboard")
      
      // Verify tokens were stored
      const user = await db.query.users.findFirst({
        where: eq(usersTable.clerkId, TEST_USER.clerkId)
      })
      
      if (user?.gmailAccessToken && user?.gmailRefreshToken) {
        console.log("Test case 4 (Happy path): Success - Tokens stored in DB")
      } else {
        console.log("Test case 4 (Happy path): Failed - Tokens not stored in DB")
      }
    } else {
      console.log("Test case 4 (Happy path): Failed - Not redirected to dashboard")
      const errorJson = await resValid.json()
      console.log("Error:", errorJson)
    }
  } catch (error) {
    console.error("Test failed:", error)
  } finally {
    // Restore original OAuth2 implementation
    google.auth.OAuth2 = originalOAuth2
  }
}

if (require.main === module) {
  testGmailCallback()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Test failed:", error)
      process.exit(1)
    })
} 