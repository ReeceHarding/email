/**
 * Gmail API Integration Tests
 * 
 * Integration tests for the Gmail API endpoints.
 * These tests verify the complete end-to-end functionality.
 */

import { NextRequest, NextResponse } from "next/server";
import { createRequest, createResponse } from "node-mocks-http";
import * as fs from "fs";
import * as path from "path";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

// Import API handlers
import { GET as handleOAuthInit } from "@/app/api/email-gmail/route";
import { POST as handleSendEmail } from "@/app/api/email-gmail/send/route";
import { GET as handleConnectionStatus } from "@/app/api/email-gmail/status/route";
import { POST as handleDisconnect } from "@/app/api/email-gmail/disconnect/route";

// Mock the googleapis module
jest.mock("googleapis", () => {
  const mockSend = jest.fn().mockResolvedValue({
    data: {
      id: "mock_message_id",
      threadId: "mock_thread_id"
    }
  });

  const mockGetProfile = jest.fn().mockResolvedValue({
    data: {
      emailAddress: "test@example.com"
    }
  });

  const mockRevokeToken = jest.fn().mockResolvedValue({});

  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => ({
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
          revokeToken: mockRevokeToken,
          getTokenInfo: jest.fn().mockResolvedValue({
            scopes: ["https://www.googleapis.com/auth/gmail.send"]
          })
        }))
      },
      gmail: jest.fn().mockImplementation(() => ({
        users: {
          messages: {
            send: mockSend
          },
          getProfile: mockGetProfile
        }
      }))
    }
  };
});

// Mock Next.js Response
jest.mock("next/server", () => {
  const actualNextServer = jest.requireActual("next/server");
  return {
    ...actualNextServer,
    NextResponse: {
      ...actualNextServer.NextResponse,
      redirect: jest.fn().mockImplementation((url) => ({
        url,
        status: 302,
        headers: new Headers({ Location: url }),
      })),
      json: jest.fn().mockImplementation((data, options) => ({
        json: () => Promise.resolve(data),
        status: options?.status || 200,
        headers: new Headers()
      }))
    }
  };
});

// Mock the database
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
          returning: jest.fn().mockResolvedValue([{ userId: "test_user_123" }])
        })
      })
    })
  }
}));

// Mock the auth library
jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({ userId: "test_user_123" })
}));

const TEST_USER = {
  userId: "test_user_123",
  gmailAccessToken: "fake_access_token",
  gmailRefreshToken: "fake_refresh_token"
};

describe("Gmail API Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up the database mock to return a test user with Gmail tokens
    (db.query.users.findFirst as jest.Mock).mockResolvedValue(TEST_USER);
  });
  
  describe("OAuth Flow", () => {
    it("redirects to Google for authorization", async () => {
      const response = await handleOAuthInit();
      
      expect(response).toBeDefined();
      expect(NextResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining("https://mock-auth-url.com")
      );
    });
  });
  
  describe("Send Email", () => {
    it("sends an email successfully", async () => {
      const request = new NextRequest("https://example.com/api/email-gmail/send", {
        method: "POST",
        body: JSON.stringify({
          userId: TEST_USER.userId,
          to: "recipient@example.com",
          subject: "Test Email",
          body: "<p>This is a test email</p>"
        })
      });
      
      const response = await handleSendEmail(request);
      const data = await response.json();
      
      expect(data).toEqual({
        success: true,
        messageId: "mock_message_id"
      });
    });
    
    it("returns an error if user has no Gmail tokens", async () => {
      // Mock user without tokens
      (db.query.users.findFirst as jest.Mock).mockResolvedValue({
        userId: TEST_USER.userId
      });
      
      const request = new NextRequest("https://example.com/api/email-gmail/send", {
        method: "POST",
        body: JSON.stringify({
          userId: TEST_USER.userId,
          to: "recipient@example.com",
          subject: "Test Email",
          body: "<p>This is a test email</p>"
        })
      });
      
      const response = await handleSendEmail(request);
      const data = await response.json();
      
      expect(data).toEqual({
        success: false,
        error: expect.stringContaining("Gmail is not connected")
      });
      expect(response.status).toBe(401);
    });
  });
  
  describe("Connection Status", () => {
    it("returns connected status when tokens exist", async () => {
      const url = new URL("https://example.com/api/email-gmail/status");
      url.searchParams.set("userId", TEST_USER.userId);
      
      const request = new NextRequest(url);
      const response = await handleConnectionStatus(request);
      const data = await response.json();
      
      expect(data).toEqual({
        connected: true,
        email: "test@example.com",
        scopes: ["https://www.googleapis.com/auth/gmail.send"]
      });
    });
    
    it("returns not connected when tokens don't exist", async () => {
      // Mock user without tokens
      (db.query.users.findFirst as jest.Mock).mockResolvedValue({
        userId: TEST_USER.userId
      });
      
      const url = new URL("https://example.com/api/email-gmail/status");
      url.searchParams.set("userId", TEST_USER.userId);
      
      const request = new NextRequest(url);
      const response = await handleConnectionStatus(request);
      const data = await response.json();
      
      expect(data).toEqual({
        connected: false
      });
    });
  });
  
  describe("Disconnect Gmail", () => {
    it("revokes tokens and clears them from database", async () => {
      const request = new NextRequest("https://example.com/api/email-gmail/disconnect", {
        method: "POST",
        body: JSON.stringify({
          userId: TEST_USER.userId
        })
      });
      
      const response = await handleDisconnect(request);
      const data = await response.json();
      
      expect(data).toEqual({
        success: true
      });
      
      // Check that the database was updated
      expect(db.update).toHaveBeenCalledWith(usersTable);
      expect(db.update().set).toHaveBeenCalledWith({
        gmailAccessToken: null,
        gmailRefreshToken: null
      });
    });
  });
}); 