/**
 * Integration Tests for Email Responses API
 * 
 * These tests verify the functionality of the email responses API endpoints:
 * - Getting thread responses (/api/email-responses/thread)
 * - Getting response statistics (/api/email-responses/stats)
 */

import { NextRequest, NextResponse } from "next/server";
import { GET as getThreadResponses } from "@/app/api/email-responses/thread/route";
import { GET as getResponseStats } from "@/app/api/email-responses/stats/route";
import { 
  getThreadResponsesAction,
  getResponseStatsAction
} from "@/actions/db/email-responses-actions";

// Mock Next.js Request
const createMockRequest = (path: string, params?: Record<string, string>): NextRequest => {
  const url = new URL(`https://example.com${path}`);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  
  return {
    nextUrl: url,
    method: "GET"
  } as unknown as NextRequest;
};

// Mock dependencies
jest.mock("@/actions/db/email-responses-actions", () => ({
  getThreadResponsesAction: jest.fn(),
  getResponseStatsAction: jest.fn()
}));

jest.mock("@/lib/auth", () => ({
  getUser: jest.fn().mockResolvedValue({ userId: "test-user-123" })
}));

jest.mock("next/server", () => {
  const originalNextServer = jest.requireActual("next/server");
  return {
    ...originalNextServer,
    NextResponse: {
      ...originalNextServer.NextResponse,
      json: jest.fn(data => ({ 
        json: () => Promise.resolve(data),
        status: 200
      }))
    }
  };
});

describe("Email Responses API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up successful mock responses
    (getThreadResponsesAction as jest.Mock).mockResolvedValue({
      isSuccess: true,
      message: "Thread responses retrieved successfully",
      data: [
        {
          id: "response-1",
          messageId: "msg-1",
          threadId: "thread-1",
          from: "sender@example.com",
          to: "recipient@example.com",
          subject: "Re: Your cold email",
          classification: "positive",
          isRead: false,
          receivedAt: new Date().toISOString()
        }
      ]
    });
    
    (getResponseStatsAction as jest.Mock).mockResolvedValue({
      isSuccess: true,
      message: "Response statistics generated successfully",
      data: {
        total: 10,
        byClassification: {
          positive: 5,
          negative: 2,
          question: 3
        },
        unread: 4,
        needsFollowUp: 2
      }
    });
  });
  
  describe("Thread Responses Endpoint", () => {
    it("gets responses for a thread successfully", async () => {
      const request = createMockRequest("/api/email-responses/thread", { threadId: "thread-1" });
      const response = await getThreadResponses(request);
      const data = await response.json();
      
      expect(getThreadResponsesAction).toHaveBeenCalledWith("test-user-123", "thread-1");
      expect(data).toEqual({
        success: true,
        responses: expect.arrayContaining([
          expect.objectContaining({
            id: "response-1",
            threadId: "thread-1"
          })
        ])
      });
    });
    
    it("handles missing threadId parameter", async () => {
      const request = createMockRequest("/api/email-responses/thread");
      const response = await getThreadResponses(request);
      const data = await response.json();
      
      expect(data).toEqual({
        success: false,
        error: "Thread ID is required"
      });
    });
    
    it("handles action errors", async () => {
      // Mock failure
      (getThreadResponsesAction as jest.Mock).mockResolvedValue({
        isSuccess: false,
        message: "Failed to get thread responses"
      });
      
      const request = createMockRequest("/api/email-responses/thread", { threadId: "thread-1" });
      const response = await getThreadResponses(request);
      const data = await response.json();
      
      expect(data).toEqual({
        success: false,
        error: "Failed to get thread responses"
      });
    });
  });
  
  describe("Response Stats Endpoint", () => {
    it("gets response statistics successfully", async () => {
      const request = createMockRequest("/api/email-responses/stats");
      const response = await getResponseStats(request);
      const data = await response.json();
      
      expect(getResponseStatsAction).toHaveBeenCalledWith("test-user-123", undefined, undefined);
      expect(data).toEqual({
        success: true,
        stats: {
          total: 10,
          byClassification: {
            positive: 5,
            negative: 2,
            question: 3
          },
          unread: 4,
          needsFollowUp: 2
        }
      });
    });
    
    it("handles date parameters correctly", async () => {
      const startDate = "2023-01-01";
      const endDate = "2023-12-31";
      
      const request = createMockRequest("/api/email-responses/stats", { 
        startDate, 
        endDate 
      });
      
      await getResponseStats(request);
      
      expect(getResponseStatsAction).toHaveBeenCalledWith(
        "test-user-123",
        expect.any(Date),
        expect.any(Date)
      );
    });
    
    it("handles action errors", async () => {
      // Mock failure
      (getResponseStatsAction as jest.Mock).mockResolvedValue({
        isSuccess: false,
        message: "Failed to get response statistics"
      });
      
      const request = createMockRequest("/api/email-responses/stats");
      const response = await getResponseStats(request);
      const data = await response.json();
      
      expect(data).toEqual({
        success: false,
        error: "Failed to get response statistics"
      });
    });
  });
}); 