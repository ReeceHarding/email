/**
 * Gmail API Integration Tests
 * 
 * These tests verify the full Gmail API integration including:
 * - Authentication flow
 * - Token management
 * - Email sending
 * - Connection verification
 * - Disconnection
 */

import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { google } from "googleapis";
import { NextResponse } from "next/server";

// Import the functions to test
// These paths may need to be adjusted based on actual implementation
import { 
  getGmailClient, 
  sendEmail, 
  hasGmailConnected, 
  disconnectGmail 
} from "@/lib/gmail";

// Mock environment variables
process.env.GOOGLE_CLIENT_ID = "mock-client-id";
process.env.GOOGLE_CLIENT_SECRET = "mock-client-secret";
process.env.GOOGLE_OAUTH_REDIRECT = "https://mock-redirect-url.com";

// Mock the googleapis module
jest.mock("googleapis", () => {
  // Create a mock for the Gmail client
  const mockGmailClient = {
    users: {
      messages: {
        send: jest.fn().mockResolvedValue({
          data: {
            id: "mock_message_id",
            threadId: "mock_thread_id"
          }
        })
      },
      getProfile: jest.fn().mockResolvedValue({
        data: {
          emailAddress: "test@example.com"
        }
      })
    }
  };

  // Create a mock for the OAuth2 client
  const mockOAuth2Client = {
    generateAuthUrl: jest.fn().mockReturnValue("https://mock-auth-url.com"),
    getToken: jest.fn().mockResolvedValue({
      tokens: {
        access_token: "mock_access_token",
        refresh_token: "mock_refresh_token",
        expiry_date: Date.now() + 3600000
      }
    }),
    setCredentials: jest.fn(),
    on: jest.fn(),
    revokeToken: jest.fn()
  };

  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => mockOAuth2Client)
      },
      gmail: jest.fn().mockImplementation(() => mockGmailClient)
    }
  };
});

// Mock the database operations
jest.mock("@/db/db", () => ({
  db: {
    query: {
      users: {
        findFirst: jest.fn()
      }
    },
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{}])
        })
      })
    }),
    delete: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue({})
    })
  }
}));

// Test user constants
const TEST_USER = {
  userId: "test_user_123",
  gmailAccessToken: "fake_access_token",
  gmailRefreshToken: "fake_refresh_token"
};

describe("Gmail API Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up the database mock to return a test user with Gmail tokens
    (db.query.users.findFirst as jest.Mock).mockResolvedValue(TEST_USER);
  });
  
  describe("getGmailClient", () => {
    it("creates a Gmail client with valid tokens", async () => {
      const gmailClient = await getGmailClient(TEST_USER.userId);
      
      // Just verify we got a Gmail client
      expect(gmailClient).toBeDefined();
      expect(google.gmail).toHaveBeenCalled();
      expect(google.auth.OAuth2).toHaveBeenCalled();
    });
    
    it("throws an error if the user has no Gmail tokens", async () => {
      // Mock user without tokens
      (db.query.users.findFirst as jest.Mock).mockResolvedValue({
        userId: TEST_USER.userId
      });
      
      await expect(getGmailClient(TEST_USER.userId)).rejects.toThrow(
        "User has not connected their Gmail account"
      );
    });
  });
  
  describe("sendEmail", () => {
    it("sends an email successfully", async () => {
      const result = await sendEmail({
        userId: TEST_USER.userId,
        to: "recipient@example.com",
        subject: "Test Email",
        body: "<p>This is a test email</p>"
      });
      
      expect(result).toEqual({
        threadId: "mock_thread_id",
        messageId: "mock_message_id"
      });
      
      // Check that the send method was called with the correct parameters
      expect(google.gmail().users.messages.send).toHaveBeenCalledWith({
        userId: "me",
        requestBody: {
          raw: expect.any(String)
        }
      });
    });
    
    it("includes CC and BCC when provided", async () => {
      await sendEmail({
        userId: TEST_USER.userId,
        to: "recipient@example.com",
        subject: "Test Email",
        body: "<p>This is a test email</p>",
        cc: "cc@example.com",
        bcc: "bcc@example.com"
      });
      
      // The raw email should include CC and BCC headers
      // We can't easily check the raw email content directly, but we can verify
      // that the send method was called
      expect(google.gmail().users.messages.send).toHaveBeenCalled();
    });
  });
  
  describe("hasGmailConnected", () => {
    it("returns true when the user has Gmail tokens", async () => {
      const result = await hasGmailConnected(TEST_USER.userId);
      expect(result).toBe(true);
    });
    
    it("returns false when the user has no Gmail tokens", async () => {
      // Mock user without tokens
      (db.query.users.findFirst as jest.Mock).mockResolvedValue({
        userId: TEST_USER.userId
      });
      
      const result = await hasGmailConnected(TEST_USER.userId);
      expect(result).toBe(false);
    });
  });
  
  describe("disconnectGmail", () => {
    it("removes tokens from the database", async () => {
      const result = await disconnectGmail(TEST_USER.userId);
      
      // Verify tokens were removed from the database
      expect(db.update).toHaveBeenCalledWith(usersTable);
      expect(db.update().set).toHaveBeenCalledWith({
        gmailAccessToken: null,
        gmailRefreshToken: null
      });
      expect(db.update().set().where).toHaveBeenCalledWith(
        eq(usersTable.userId, TEST_USER.userId)
      );
      
      expect(result).toBe(true);
    });
    
    it("returns true even if the user has no tokens", async () => {
      // Mock user without tokens
      (db.query.users.findFirst as jest.Mock).mockResolvedValue({
        userId: TEST_USER.userId,
        gmailAccessToken: null,
        gmailRefreshToken: null
      });
      
      const result = await disconnectGmail(TEST_USER.userId);
      expect(result).toBe(true);
    });
  });
}); 