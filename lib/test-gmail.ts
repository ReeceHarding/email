import { NextRequest } from "next/server";
import { GET as initiateOAuthFlow } from "@/app/api/email-gmail/route";
import { GET as handleOAuthCallback } from "@/app/api/email-gmail/oauth-callback/route";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { google } from "googleapis";

// Mock the googleapis module for testing
const originalOAuth2 = google.auth.OAuth2;
google.auth.OAuth2 = function mockOAuth2() {
  return {
    generateAuthUrl: () => "https://mock-google-auth-url.com",
    getToken: async (code: string) => {
      if (code === "valid_test_code") {
        return {
          tokens: {
            access_token: "mock_access_token",
            refresh_token: "mock_refresh_token"
          }
        };
      }
      throw new Error("Invalid authorization code");
    }
  };
} as any;

// Test user for our tests
const TEST_USER = {
  clerkId: "test_user_123",
  email: "test@example.com"
};

/**
 * Set up a test user in the database
 */
async function setupTestUser() {
  console.log("Setting up test user...");
  try {
    // Delete existing test user if any
    await db.delete(usersTable)
      .where(eq(usersTable.clerkId, TEST_USER.clerkId));
    
    // Create new test user
    const [user] = await db.insert(usersTable)
      .values(TEST_USER)
      .returning();
    
    console.log("Test user created:", user);
    return user;
  } catch (error) {
    console.error("Error setting up test user:", error);
    throw error;
  }
}

/**
 * Clean up test user from database
 */
async function cleanupTestUser() {
  console.log("Cleaning up test user...");
  try {
    await db.delete(usersTable)
      .where(eq(usersTable.clerkId, TEST_USER.clerkId));
    console.log("Test user deleted");
  } catch (error) {
    console.error("Error cleaning up test user:", error);
  }
}

/**
 * Restore original OAuth2 implementation
 */
function restoreOAuth2() {
  google.auth.OAuth2 = originalOAuth2;
}

/**
 * Run all tests
 */
async function runTests() {
  console.log("=== GMAIL OAUTH TESTS ===");
  
  try {
    // Set up test user
    await setupTestUser();
    
    // Test 1: Initiate OAuth flow
    console.log("\nTest 1: Initiate OAuth Flow");
    const initResult = await initiateOAuthFlow();
    const isRedirectUrl = initResult instanceof Response && 
      initResult.headers.get("location")?.includes("mock-google-auth-url.com");
    
    console.log("OAuth flow initiation:", isRedirectUrl ? "✅ SUCCESS" : "❌ FAILED");
    
    // Test 2: Callback with missing code
    console.log("\nTest 2: Callback with missing code");
    const reqMissingCode = new NextRequest(
      new Request("http://localhost:3000/api/email-gmail/oauth-callback?state=" + TEST_USER.clerkId)
    );
    const missingCodeResult = await handleOAuthCallback(reqMissingCode);
    const missingCodeRedirect = missingCodeResult.headers.get("location");
    
    console.log("Missing code handling:", 
      missingCodeRedirect && missingCodeRedirect.includes("error=Missing") 
        ? "✅ SUCCESS" 
        : "❌ FAILED"
    );
    
    // Test 3: Callback with missing state
    console.log("\nTest 3: Callback with missing state");
    const reqMissingState = new NextRequest(
      new Request("http://localhost:3000/api/email-gmail/oauth-callback?code=some_code")
    );
    const missingStateResult = await handleOAuthCallback(reqMissingState);
    const missingStateRedirect = missingStateResult.headers.get("location");
    
    console.log("Missing state handling:", 
      missingStateRedirect && missingStateRedirect.includes("error=Missing") 
        ? "✅ SUCCESS" 
        : "❌ FAILED"
    );
    
    // Test 4: Callback with invalid user
    console.log("\nTest 4: Callback with invalid user");
    const reqInvalidUser = new NextRequest(
      new Request("http://localhost:3000/api/email-gmail/oauth-callback?code=some_code&state=invalid_user_id")
    );
    const invalidUserResult = await handleOAuthCallback(reqInvalidUser);
    const invalidUserRedirect = invalidUserResult.headers.get("location");
    
    console.log("Invalid user handling:", 
      invalidUserRedirect && invalidUserRedirect.includes("error=User") 
        ? "✅ SUCCESS" 
        : "❌ FAILED"
    );
    
    // Test 5: Callback with valid code
    console.log("\nTest 5: Callback with valid code");
    const reqValidCode = new NextRequest(
      new Request("http://localhost:3000/api/email-gmail/oauth-callback?code=valid_test_code&state=" + TEST_USER.clerkId)
    );
    const validCodeResult = await handleOAuthCallback(reqValidCode);
    const validCodeRedirect = validCodeResult.headers.get("location");
    
    console.log("Valid code handling:", 
      validCodeRedirect && validCodeRedirect.includes("message=Gmail") 
        ? "✅ SUCCESS" 
        : "❌ FAILED"
    );
    
    // Verify tokens were stored
    const user = await db.query.users.findFirst({
      where: eq(usersTable.clerkId, TEST_USER.clerkId)
    });
    
    console.log("Tokens storage:", 
      user?.gmailAccessToken === "mock_access_token" && user?.gmailRefreshToken === "mock_refresh_token"
        ? "✅ SUCCESS" 
        : "❌ FAILED"
    );
    
    // Test 6: Callback with invalid code
    console.log("\nTest 6: Callback with invalid code");
    const reqInvalidCode = new NextRequest(
      new Request("http://localhost:3000/api/email-gmail/oauth-callback?code=invalid_code&state=" + TEST_USER.clerkId)
    );
    const invalidCodeResult = await handleOAuthCallback(reqInvalidCode);
    const invalidCodeRedirect = invalidCodeResult.headers.get("location");
    
    console.log("Invalid code handling:", 
      invalidCodeRedirect && invalidCodeRedirect.includes("error=Failed") 
        ? "✅ SUCCESS" 
        : "❌ FAILED"
    );
    
  } catch (error) {
    console.error("Test error:", error);
  } finally {
    // Clean up
    await cleanupTestUser();
    restoreOAuth2();
  }
  
  console.log("\n=== TESTS COMPLETED ===");
}

// Execute tests if run directly
if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch(error => {
      console.error("Test failed:", error);
      process.exit(1);
    });
}

// Export functions for use in other tests
export {
  setupTestUser,
  cleanupTestUser,
  TEST_USER
}; 