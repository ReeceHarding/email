/**
 * Unit tests for the Email Queue Service
 * 
 * These tests verify the core functionality of the email queue service:
 * - Adding emails to the queue
 * - Processing the queue
 * - Handling retries
 * - Tracking status
 * - Measuring performance
 */

import { db } from "@/db/db";
import { emailQueueTable, emailStatusEnum } from "@/db/schema/email-queue-schema";
import { eq } from "drizzle-orm";
import {
  addToEmailQueue,
  processEmailQueue,
  getEmailQueueMetrics,
  getEmailQueueItem
} from "@/lib/email-queue-service";
import { sendEmail } from "@/lib/gmail";

// Mock dependencies
jest.mock("@/lib/gmail", () => ({
  sendEmail: jest.fn()
}));

jest.mock("@/db/db", () => ({
  db: {
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([
          {
            id: "mock-queue-id",
            status: "queued",
            attempts: 0
          }
        ])
      })
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{}])
      })
    }),
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              {
                id: "mock-queue-id",
                userId: "test-user",
                to: "test@example.com",
                subject: "Test Email",
                body: "<p>Test</p>",
                status: "queued",
                attempts: 0,
                maxAttempts: 3
              }
            ])
          }),
          limit: jest.fn().mockResolvedValue([
            {
              id: "mock-queue-id",
              userId: "test-user",
              status: "queued"
            }
          ])
        })
      })
    }),
    query: {
      emailQueueTable: {
        findFirst: jest.fn().mockResolvedValue({
          id: "mock-queue-id",
          status: "queued"
        })
      }
    }
  }
}));

// Test constants
const TEST_USER = "test-user-123";
const TEST_EMAIL = {
  to: "test@example.com",
  subject: "Test Email",
  body: "<p>This is a test email</p>"
};

describe("Email Queue Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up mock for sendEmail
    (sendEmail as jest.Mock).mockResolvedValue({
      threadId: "mock-thread-id",
      messageId: "mock-message-id"
    });
  });
  
  describe("addToEmailQueue", () => {
    it("adds an email to the queue", async () => {
      const result = await addToEmailQueue({
        userId: TEST_USER,
        ...TEST_EMAIL
      });
      
      expect(result.isSuccess).toEqual(true);
      expect(db.insert).toHaveBeenCalledWith(emailQueueTable);
      expect(db.insert().values).toHaveBeenCalled();
      expect(db.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER,
          to: TEST_EMAIL.to,
          subject: TEST_EMAIL.subject,
          body: TEST_EMAIL.body,
          status: "queued"
        })
      );
    });
    
    it("schedules an email for future delivery", async () => {
      const scheduledDate = new Date(Date.now() + 3600000); // 1 hour in the future
      
      const result = await addToEmailQueue({
        userId: TEST_USER,
        ...TEST_EMAIL,
        scheduledFor: scheduledDate
      });
      
      expect(result.isSuccess).toEqual(true);
      expect(db.insert().values).toHaveBeenCalled();
      expect(db.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "scheduled",
          scheduledFor: scheduledDate
        })
      );
    });
  });
  
  describe("processEmailQueue", () => {
    it("processes queued emails", async () => {
      const result = await processEmailQueue();
      
      expect(result.isSuccess).toEqual(true);
      expect(db.select).toHaveBeenCalled();
      expect(sendEmail).toHaveBeenCalled();
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "test-user",
          to: "test@example.com",
          subject: "Test Email"
        })
      );
      expect(db.update).toHaveBeenCalledWith(emailQueueTable);
    });
    
    it("handles send failures and schedules retries", async () => {
      // Mock a failed send
      (sendEmail as jest.Mock).mockRejectedValue(new Error("Test error"));
      
      const result = await processEmailQueue();
      
      expect(result.isSuccess).toEqual(true);
      expect(db.update).toHaveBeenCalledWith(emailQueueTable);
      // Check the update to status=retrying happened
      expect(db.update().set).toHaveBeenCalled();
      expect(db.update().set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "retrying"
        })
      );
    });
  });
  
  describe("getEmailQueueMetrics", () => {
    it("retrieves queue metrics", async () => {
      const result = await getEmailQueueMetrics();
      
      expect(result.isSuccess).toEqual(true);
      expect(result.data).toHaveProperty("queueSize");
      expect(result.data).toHaveProperty("processingTime");
      expect(result.data).toHaveProperty("successRate");
      expect(result.data).toHaveProperty("statusCounts");
    });
  });
  
  describe("getEmailQueueItem", () => {
    it("retrieves a specific queue item", async () => {
      const result = await getEmailQueueItem("mock-queue-id");
      
      expect(result.isSuccess).toEqual(true);
      expect(db.select).toHaveBeenCalled();
      expect(db.select().from).toHaveBeenCalledWith(emailQueueTable);
      expect(db.select().from().where).toHaveBeenCalledWith(
        eq(emailQueueTable.id, "mock-queue-id")
      );
    });
    
    it("returns an error for non-existent items", async () => {
      // Mock an empty result
      (db.select().from().where().limit as jest.Mock).mockResolvedValueOnce([]);
      
      const result = await getEmailQueueItem("non-existent");
      
      expect(result.isSuccess).toEqual(false);
      expect(result.message).toContain("not found");
    });
  });
}); 