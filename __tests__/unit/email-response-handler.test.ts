/**
 * Unit tests for the Email Response Handler
 * 
 * These tests verify the functionality of the email response handler:
 * - Processing incoming emails
 * - Classifying responses
 * - Managing email threads
 */

import { 
  processIncomingEmail,
  getThreadResponses,
  getResponsesSummary,
  ResponseClassification,
  EmailResponse
} from "@/lib/email-response-handler";
import { getGmailClient } from "@/lib/gmail";

// Mock dependencies
jest.mock("@/lib/gmail", () => ({
  getGmailClient: jest.fn()
}));

// Mock OpenAI
jest.mock("openai", () => {
  const mockCreate = jest.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            classification: "positive",
            confidence: 0.95,
            keyPoints: ["Interested in learning more", "Asked about pricing"]
          })
        }
      }
    ]
  });
  
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }))
  };
});

// Import mocked OpenAI for later use
const { OpenAI } = require('openai');
const mockCreate = OpenAI().chat.completions.create;

// Set up Gmail client mock
const mockGmailClient = {
  users: {
    history: {
      list: jest.fn()
    },
    messages: {
      get: jest.fn()
    },
    threads: {
      get: jest.fn()
    }
  }
};

// Test constants
const TEST_USER_ID = "test-user-123";
const TEST_HISTORY_ID = "12345";
const TEST_MESSAGE_ID = "msg-123";
const TEST_THREAD_ID = "thread-456";

describe("Email Response Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default mocks
    (getGmailClient as jest.Mock).mockResolvedValue(mockGmailClient);
    
    // Set up history list mock response
    mockGmailClient.users.history.list.mockResolvedValue({
      data: {
        history: [
          {
            messagesAdded: [
              {
                message: {
                  id: TEST_MESSAGE_ID,
                  threadId: TEST_THREAD_ID
                }
              }
            ]
          }
        ]
      }
    });
    
    // Set up message get mock response
    mockGmailClient.users.messages.get.mockResolvedValue({
      data: {
        id: TEST_MESSAGE_ID,
        threadId: TEST_THREAD_ID,
        payload: {
          headers: [
            { name: "From", value: "sender@example.com" },
            { name: "To", value: "recipient@example.com" },
            { name: "Subject", value: "Re: Your cold email" }
          ],
          body: {
            data: Buffer.from("Thank you for reaching out. I'd like to learn more.").toString("base64")
          }
        }
      }
    });
    
    // Set up thread get mock response
    mockGmailClient.users.threads.get.mockResolvedValue({
      data: {
        messages: [
          { id: "original-msg-id" },
          { id: TEST_MESSAGE_ID }
        ]
      }
    });
  });
  
  describe("processIncomingEmail", () => {
    it("processes incoming emails from Gmail webhook notification", async () => {
      const result = await processIncomingEmail(TEST_USER_ID, TEST_HISTORY_ID);
      
      // Verify that the function succeeded
      expect(result.isSuccess).toBe(true);
      
      // Verify that Gmail API was called correctly
      expect(getGmailClient).toHaveBeenCalledWith(TEST_USER_ID);
      expect(mockGmailClient.users.history.list).toHaveBeenCalledWith({
        userId: "me",
        startHistoryId: TEST_HISTORY_ID,
        historyTypes: ["messageAdded"]
      });
      
      // Verify that message details were fetched
      expect(mockGmailClient.users.messages.get).toHaveBeenCalledWith({
        userId: "me",
        id: TEST_MESSAGE_ID,
        format: "full"
      });
      
      // Verify that thread details were fetched
      expect(mockGmailClient.users.threads.get).toHaveBeenCalledWith({
        userId: "me",
        id: TEST_THREAD_ID
      });
      
      // Verify returned data
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty("messageId", TEST_MESSAGE_ID);
      expect(result.data[0]).toHaveProperty("threadId", TEST_THREAD_ID);
      expect(result.data[0]).toHaveProperty("classification", "positive");
      expect(result.data[0]).toHaveProperty("keyPoints");
    });
    
    it("handles errors during email processing", async () => {
      // Set up error in Gmail client
      mockGmailClient.users.history.list.mockRejectedValue(new Error("API error"));
      
      const result = await processIncomingEmail(TEST_USER_ID, TEST_HISTORY_ID);
      
      // Verify the function failed gracefully
      expect(result.isSuccess).toBe(false);
      expect(result.message).toContain("Failed to process email response");
    });
    
    it("skips messages that aren't incoming emails", async () => {
      // Replace the mock implementation to test the isIncomingEmail check
      // This is a simplified test - in a real implementation you would have
      // more complex checks to determine if an email is incoming
      
      // Mock a response with a specific format that would be rejected
      mockGmailClient.users.messages.get.mockResolvedValue({
        data: {
          id: TEST_MESSAGE_ID,
          threadId: TEST_THREAD_ID,
          payload: {
            headers: [
              // Missing required headers
            ]
          }
        }
      });
      
      const result = await processIncomingEmail(TEST_USER_ID, TEST_HISTORY_ID);
      
      // Verify that the function succeeded but no emails were processed
      expect(result.isSuccess).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });
  
  describe("classification", () => {
    it("classifies responses with AI", async () => {
      // This test relies on the mocks set up in beforeEach
      // and the internal classifyEmailResponse function being called
      // by processIncomingEmail
      
      const result = await processIncomingEmail(TEST_USER_ID, TEST_HISTORY_ID);
      
      expect(result.isSuccess).toBe(true);
      expect(result.data[0]).toHaveProperty("classification", "positive");
      expect(result.data[0]).toHaveProperty("confidence", 0.95);
      expect(result.data[0].keyPoints).toEqual(["Interested in learning more", "Asked about pricing"]);
    });
    
    it("handles AI classification errors gracefully", async () => {
      // Set up OpenAI error for this test only
      mockCreate.mockRejectedValueOnce(new Error("OpenAI API error"));
      
      const result = await processIncomingEmail(TEST_USER_ID, TEST_HISTORY_ID);
      
      // Should still succeed but with a default classification
      expect(result.isSuccess).toBe(true);
      expect(result.data[0]).toHaveProperty("classification", ResponseClassification.OTHER);
      expect(result.data[0].confidence).toBeLessThanOrEqual(0.5);
      expect(result.data[0].keyPoints).toContainEqual(expect.stringContaining("classification failed"));
    });
  });
}); 