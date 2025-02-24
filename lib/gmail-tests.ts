/**
 * Gmail Integration Tests
 * 
 * Simple test runner for Gmail OAuth integration tests.
 * This file intentionally uses a simple testing approach without relying on Jest,
 * to avoid TypeScript declaration conflicts.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { google } from "googleapis";
import { 
  getGmailClient, 
  sendEmail, 
  hasGmailConnected, 
  disconnectGmail 
} from "@/lib/gmail";

// Simple mock of Jest for running tests with ts-node
const createMockFn = () => {
  const mockFn: any = (...args: any[]) => {
    mockFn.mock.calls.push(args);
    return mockFn.returnValue;
  };
  
  mockFn.mock = { calls: [] };
  mockFn.returnValue = undefined;
  
  mockFn.mockReturnValue = (value: any) => {
    mockFn.returnValue = value;
    return mockFn;
  };
  
  mockFn.mockResolvedValue = (value: any) => {
    mockFn.returnValue = Promise.resolve(value);
    return mockFn;
  };
  
  mockFn.mockImplementation = (impl: Function) => {
    const originalMockFn = mockFn;
    
    const newMockFn: any = (...args: any[]) => {
      newMockFn.mock.calls.push(args);
      return impl(...args);
    };
    
    newMockFn.mock = { calls: [] };
    newMockFn.mockReturnValue = originalMockFn.mockReturnValue;
    newMockFn.mockResolvedValue = originalMockFn.mockResolvedValue;
    newMockFn.mockImplementation = originalMockFn.mockImplementation;
    
    return newMockFn;
  };
  
  return mockFn;
};

const jest = {
  fn: () => createMockFn(),
  mock: (moduleName: string, factory: Function) => {
    // This simple mock function just returns the factory function's result
    return factory();
  },
  restoreAllMocks: () => {}
};

// Store original Google OAuth2 implementation
const originalOAuth2 = google.auth.OAuth2;

// Mock tokens for testing
const mockTokens = {
  access_token: "mock_access_token",
  refresh_token: "mock_refresh_token",
  expiry_date: Date.now() + 3600000
};

// Type definitions for mocks
type MockGmailClient = {
  users: {
    messages: {
      send: any;
    };
  };
};

interface MockOAuth2Client {
  generateAuthUrl: any;
  getToken: any;
  setCredentials: any;
  on: any;
}

// Test user constants
const TEST_USER = {
  clerkId: "test_user_123",
  email: "test@example.com",
  gmailAccessToken: null as string | null,
  gmailRefreshToken: null as string | null
};

// Mock current auth user ID
const mockAuth = createMockFn().mockResolvedValue({ userId: TEST_USER.clerkId });
const mockClerkAuth = jest.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth
}));

/**
 * Simple assertion helpers
 */
function assertEqual(actual: any, expected: any, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected} but got ${actual}`);
  }
}

function assertNotNull(actual: any, message: string): void {
  if (actual === null || actual === undefined) {
    throw new Error(`${message}: expected value to not be null/undefined`);
  }
}

function assertContains(text: string, substring: string, message: string): void {
  if (!text || !text.includes(substring)) {
    throw new Error(`${message}: expected "${text}" to contain "${substring}"`);
  }
}

function assertInstanceOf(obj: any, expectedClass: any, message: string): void {
  if (!(obj instanceof expectedClass)) {
    throw new Error(`${message}: expected instance of ${expectedClass.name}`);
  }
}

function assertCalled(mockFn: any, message: string): void {
  if (!mockFn.mock || mockFn.mock.calls.length === 0) {
    throw new Error(`${message}: expected function to have been called`);
  }
}

function assertCalledWith(mockFn: any, args: any, message: string): void {
  assertCalled(mockFn, message);
  // We're just checking that it was called, not checking the exact arguments
}

function assertDeepEqual(actual: any, expected: any, message: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${message}: expected ${expectedStr} but got ${actualStr}`);
  }
}

/**
 * Setup and teardown utilities
 */
async function setupTestUser(withTokens = false) {
  try {
    // Delete any existing test user
    await db.delete(usersTable)
      .where(eq(usersTable.clerkId, TEST_USER.clerkId));
    
    // Create user with or without tokens
    const userData = { ...TEST_USER };
    if (withTokens) {
      userData.gmailAccessToken = mockTokens.access_token;
      userData.gmailRefreshToken = mockTokens.refresh_token;
    }
    
    const [user] = await db.insert(usersTable)
      .values(userData)
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

function setupMocks() {
  // Mock OAuth2
  const mockGenerateAuthUrl = createMockFn().mockReturnValue("https://mock-auth-url.com");
  const mockGetToken = createMockFn().mockResolvedValue({ tokens: mockTokens });
  const mockSetCredentials = createMockFn();
  const mockOn = createMockFn();
  
  const mockOAuth2Client: MockOAuth2Client = {
    generateAuthUrl: mockGenerateAuthUrl,
    getToken: mockGetToken,
    setCredentials: mockSetCredentials,
    on: mockOn
  };
  
  // Mock OAuth2 constructor
  const mockOAuth2Constructor = createMockFn().mockImplementation(() => mockOAuth2Client);
  google.auth.OAuth2 = mockOAuth2Constructor as any;
  
  // Mock Gmail client
  const mockSend = createMockFn().mockResolvedValue({
    data: {
      id: "mock_message_id",
      threadId: "mock_thread_id"
    }
  });
  
  const mockGmailClient: MockGmailClient = {
    users: {
      messages: {
        send: mockSend
      }
    }
  };
  
  const mockGmailConstructor = createMockFn().mockReturnValue(mockGmailClient);
  google.gmail = mockGmailConstructor as any;
  
  return { mockGmailClient, mockOAuth2Client };
}

function restoreMocks() {
  google.auth.OAuth2 = originalOAuth2;
}

/**
 * Run a single test with proper setup/cleanup
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
 * Test implementations
 */
async function testCreateGmailClient() {
  const { mockOAuth2Client } = setupMocks();
  try {
    await setupTestUser(true);
    
    const gmailClient = await getGmailClient(TEST_USER.clerkId);
    assertNotNull(gmailClient, "Gmail client should be created");
    
    assertCalled(google.auth.OAuth2 as any, "OAuth2 client should be created");
    assertCalled(mockOAuth2Client.setCredentials, "Credentials should be set");
    assertCalled(mockOAuth2Client.on, "Token refresh handler should be set up");
  } finally {
    await cleanupTestUser();
    restoreMocks();
  }
}

async function testSendEmail() {
  const { mockGmailClient } = setupMocks();
  try {
    await setupTestUser(true);
    
    const result = await sendEmail({
      userClerkId: TEST_USER.clerkId,
      to: "recipient@example.com",
      subject: "Test Subject",
      body: "<p>Test Body</p>"
    });
    
    assertDeepEqual(result, {
      messageId: "mock_message_id",
      threadId: "mock_thread_id"
    }, "Should return message and thread IDs");
    
    assertCalled(mockGmailClient.users.messages.send, "Send method should be called");
    
    const sendCall = mockGmailClient.users.messages.send.mock.calls[0][0];
    assertEqual(sendCall.userId, "me", "Should use 'me' as user ID");
    assertNotNull(sendCall.requestBody.raw, "Raw email should be included");
  } finally {
    await cleanupTestUser();
    restoreMocks();
  }
}

async function testCheckGmailConnection() {
  setupMocks();
  try {
    // First with no tokens
    await setupTestUser(false);
    let isConnected = await hasGmailConnected(TEST_USER.clerkId);
    assertEqual(isConnected, false, "Should report not connected without tokens");
    
    // Then with tokens
    await setupTestUser(true);
    isConnected = await hasGmailConnected(TEST_USER.clerkId);
    assertEqual(isConnected, true, "Should report connected with tokens");
  } finally {
    await cleanupTestUser();
    restoreMocks();
  }
}

async function testDisconnectGmail() {
  setupMocks();
  try {
    await setupTestUser(true);
    
    // Verify tokens exist before disconnect
    let user = await db.query.users.findFirst({
      where: eq(usersTable.clerkId, TEST_USER.clerkId)
    });
    
    assertNotNull(user, "User should exist before disconnecting");
    assertEqual(user?.gmailAccessToken, mockTokens.access_token, "Access token should be set before disconnect");
    assertEqual(user?.gmailRefreshToken, mockTokens.refresh_token, "Refresh token should be set before disconnect");
    
    // Disconnect
    const success = await disconnectGmail(TEST_USER.clerkId);
    assertEqual(success, true, "Disconnect should report success");
    
    // Verify tokens are removed
    user = await db.query.users.findFirst({
      where: eq(usersTable.clerkId, TEST_USER.clerkId)
    });
    
    assertNotNull(user, "User should exist after disconnecting");
    assertEqual(user?.gmailAccessToken, null, "Access token should be null after disconnect");
    assertEqual(user?.gmailRefreshToken, null, "Refresh token should be null after disconnect");
  } finally {
    await cleanupTestUser();
    restoreMocks();
  }
}

async function testEmailWithOptions() {
  const { mockGmailClient } = setupMocks();
  try {
    await setupTestUser(true);
    
    await sendEmail({
      userClerkId: TEST_USER.clerkId,
      to: "recipient@example.com",
      subject: "Test Subject",
      body: "<p>Test Body</p>",
      cc: "cc@example.com",
      bcc: "bcc@example.com"
    });
    
    assertCalled(mockGmailClient.users.messages.send, "Send method should be called");
    
    const sendCall = mockGmailClient.users.messages.send.mock.calls[0][0];
    assertNotNull(sendCall.requestBody.raw, "Raw email should be included");
  } finally {
    await cleanupTestUser();
    restoreMocks();
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("=== RUNNING GMAIL OAUTH TESTS ===\n");
  
  const tests = [
    { name: "Test 1: Create Gmail client", fn: testCreateGmailClient },
    { name: "Test 2: Send email", fn: testSendEmail },
    { name: "Test 3: Check Gmail connection", fn: testCheckGmailConnection },
    { name: "Test 4: Disconnect Gmail", fn: testDisconnectGmail },
    { name: "Test 5: Email with options", fn: testEmailWithOptions }
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
  
  console.log("\n=== GMAIL OAUTH TESTS COMPLETED ===");
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

// Export for use in other tests
export {
  setupTestUser,
  cleanupTestUser,
  TEST_USER,
  runTests
}; 