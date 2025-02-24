/**
 * Manual Gmail Tests
 * 
 * This is a simple manual test for Gmail functionality.
 * It doesn't rely on mocks or complex testing frameworks.
 */

import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { 
  sendEmail, 
  hasGmailConnected, 
  disconnectGmail 
} from "@/lib/gmail";

// Test constants
const TEST_USER = {
  clerkId: "test_user_123",
  email: "test@example.com",
  gmailAccessToken: "mock_access_token", 
  gmailRefreshToken: "mock_refresh_token"
};

/**
 * Run a simple test and log the result
 */
async function runTest(name: string, testFn: () => Promise<void>): Promise<boolean> {
  console.log(`\nRunning: ${name}`);
  try {
    await testFn();
    console.log(`✅ PASS: ${name}`);
    return true;
  } catch (error) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   ${error}`);
    return false;
  }
}

/**
 * Setup and teardown utilities
 */
async function setupTestUser() {
  try {
    // Delete any existing test user
    await db.delete(usersTable)
      .where(eq(usersTable.clerkId, TEST_USER.clerkId));
    
    // Create test user with tokens
    const [user] = await db.insert(usersTable)
      .values(TEST_USER)
      .returning();
    
    return user;
  } catch (error) {
    console.error("Error setting up test user:", error);
    throw error;
  }
}

async function cleanupTestUser() {
  try {
    await db.delete(usersTable)
      .where(eq(usersTable.clerkId, TEST_USER.clerkId));
  } catch (error) {
    console.error("Error cleaning up test user:", error);
  }
}

/**
 * Test check Gmail connection status
 */
async function testCheckGmailConnection() {
  console.log("Setting up test user with Gmail tokens...");
  await setupTestUser();
  
  console.log("Checking Gmail connection status...");
  const isConnected = await hasGmailConnected(TEST_USER.clerkId);
  
  if (!isConnected) {
    throw new Error("Expected Gmail to be connected");
  }
  
  console.log("Disconnecting Gmail...");
  const disconnected = await disconnectGmail(TEST_USER.clerkId);
  
  if (!disconnected) {
    throw new Error("Failed to disconnect Gmail");
  }
  
  console.log("Checking connection status again...");
  const isStillConnected = await hasGmailConnected(TEST_USER.clerkId);
  
  if (isStillConnected) {
    throw new Error("Expected Gmail to be disconnected");
  }
  
  console.log("Cleaning up test user...");
  await cleanupTestUser();
}

/**
 * Run all the tests
 */
async function runTests() {
  console.log("=== RUNNING MANUAL GMAIL TESTS ===\n");
  
  const tests = [
    { name: "Check Gmail connection", fn: testCheckGmailConnection }
  ];
  
  let passed = 0;
  const failed: string[] = [];
  
  for (const test of tests) {
    const success = await runTest(test.name, test.fn);
    if (success) {
      passed++;
    } else {
      failed.push(test.name);
    }
  }
  
  console.log("\n=== GMAIL TESTS COMPLETED ===");
  console.log(`\nResults: ${passed}/${tests.length} tests passed`);
  
  if (failed.length > 0) {
    console.log("\nFailed tests:");
    failed.forEach(name => console.log(`  - ${name}`));
    process.exit(1);
  } else {
    console.log("\nAll tests passed successfully!");
    process.exit(0);
  }
}

// Execute if run directly 
if (require.main === module) {
  runTests()
    .catch(error => {
      console.error("Test runner failed:", error);
      process.exit(1);
    });
}

// Export for testing
export { runTests }; 