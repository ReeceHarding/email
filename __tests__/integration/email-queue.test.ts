/**
 * Integration Tests for Email Queue API
 * 
 * These tests verify the functionality of the email queue API endpoints:
 * - Processing the queue (/api/email-queue/process)
 * - Getting queue metrics (/api/email-queue/metrics)
 */

import { NextRequest, NextResponse } from "next/server";
import { POST as processQueue } from "@/app/api/email-queue/process/route";
import { GET as getMetrics } from "@/app/api/email-queue/metrics/route";
import { processQueueAction, getQueueMetricsAction } from "@/actions/db/email-queue-actions";

// Mock Next.js Request/Response
const createMockRequest = (method = "GET", body?: any): NextRequest => {
  const request = {
    method,
    json: jest.fn().mockResolvedValue(body || {}),
    nextUrl: new URL("https://example.com")
  } as unknown as NextRequest;
  return request;
};

// Mock dependencies
jest.mock("@/actions/db/email-queue-actions", () => ({
  processQueueAction: jest.fn(),
  getQueueMetricsAction: jest.fn()
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

describe("Email Queue API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up successful mock responses
    (processQueueAction as jest.Mock).mockResolvedValue({
      isSuccess: true,
      message: "Queue processed successfully",
      data: {
        processed: 2,
        successful: 1,
        failed: 1
      }
    });
    
    (getQueueMetricsAction as jest.Mock).mockResolvedValue({
      isSuccess: true,
      message: "Metrics retrieved successfully",
      data: {
        queueSize: 10,
        processingTime: 500,
        successRate: 0.9,
        lastProcessedAt: new Date(),
        statusCounts: {
          queued: 5,
          sent: 20
        }
      }
    });
  });
  
  describe("Process Queue Endpoint", () => {
    it("processes the queue successfully", async () => {
      const request = createMockRequest("POST", { batchSize: 5 });
      const response = await processQueue(request);
      const data = await response.json();
      
      expect(processQueueAction).toHaveBeenCalledWith(5);
      expect(data).toEqual({
        success: true,
        processed: 2,
        successful: 1,
        failed: 1
      });
    });
    
    it("handles errors when processing queue", async () => {
      // Mock failure
      (processQueueAction as jest.Mock).mockResolvedValue({
        isSuccess: false,
        message: "Failed to process queue"
      });
      
      const request = createMockRequest("POST");
      const response = await processQueue(request);
      const data = await response.json();
      
      expect(data).toEqual({
        error: "Failed to process queue"
      });
    });
  });
  
  describe("Queue Metrics Endpoint", () => {
    it("returns queue metrics successfully", async () => {
      const request = createMockRequest();
      const response = await getMetrics(request);
      const data = await response.json();
      
      expect(getQueueMetricsAction).toHaveBeenCalled();
      expect(data).toEqual({
        success: true,
        metrics: {
          queueSize: 10,
          processingTime: 500,
          successRate: 0.9,
          lastProcessedAt: expect.any(Date),
          statusCounts: {
            queued: 5,
            sent: 20
          }
        }
      });
    });
    
    it("handles errors when getting metrics", async () => {
      // Mock failure
      (getQueueMetricsAction as jest.Mock).mockResolvedValue({
        isSuccess: false,
        message: "Failed to get metrics"
      });
      
      const request = createMockRequest();
      const response = await getMetrics(request);
      const data = await response.json();
      
      expect(data).toEqual({
        error: "Failed to get metrics"
      });
    });
  });
}); 