"use server"

/**
 * Email Responses Server Actions
 * 
 * This file contains server actions for managing email responses.
 * These include storing, retrieving, and analyzing responses to outreach emails.
 */

import { ActionState } from "@/types";
import { db } from "@/db/db";
import { 
  emailResponsesTable, 
  emailThreadsTable,
  InsertEmailResponse,
  SelectEmailResponse,
  SelectEmailThread
} from "@/db/schema";
import { eq, and, desc, like, gte, lte } from "drizzle-orm";
import { 
  EmailResponse,
  ResponseClassification,
  processIncomingEmail, 
  getThreadResponses,
  getResponsesSummary
} from "@/lib/email-response-handler";

/**
 * Store an email response in the database
 */
export async function storeEmailResponseAction(
  response: EmailResponse
): Promise<ActionState<SelectEmailResponse>> {
  console.log(`[Email Response Action] Storing response from ${response.from}`);
  
  try {
    // Convert EmailResponse to InsertEmailResponse
    const insertData: InsertEmailResponse = {
      userId: response.userId,
      messageId: response.messageId,
      threadId: response.threadId,
      originalEmailId: response.originalEmailId,
      from: response.from,
      to: response.to,
      subject: response.subject,
      body: response.body,
      classification: response.classification,
      confidence: response.confidence,
      keyPoints: response.keyPoints ? JSON.stringify(response.keyPoints) : null,
      receivedAt: response.receivedAt,
      processedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert into database
    const [storedResponse] = await db.insert(emailResponsesTable)
      .values(insertData)
      .returning();
    
    // Update thread information
    await updateOrCreateThreadAction(response);
    
    return {
      isSuccess: true,
      message: "Email response stored successfully",
      data: storedResponse
    };
  } catch (error: any) {
    console.error("[Email Response Action] Error storing response:", error);
    return {
      isSuccess: false,
      message: `Failed to store email response: ${error.message}`
    };
  }
}

/**
 * Update an existing thread or create a new one
 */
async function updateOrCreateThreadAction(
  response: EmailResponse
): Promise<void> {
  try {
    // Check if thread already exists
    const existingThread = await db.select()
      .from(emailThreadsTable)
      .where(eq(emailThreadsTable.threadId, response.threadId))
      .limit(1);
    
    if (existingThread.length > 0) {
      // Update existing thread
      await db.update(emailThreadsTable)
        .set({
          lastMessageAt: response.receivedAt,
          hasUnread: true,
          messageCount: (parseInt(existingThread[0].messageCount) + 1).toString(),
          updatedAt: new Date()
        })
        .where(eq(emailThreadsTable.threadId, response.threadId));
    } else {
      // Create new thread
      await db.insert(emailThreadsTable)
        .values({
          userId: response.userId,
          threadId: response.threadId,
          subject: response.subject,
          recipientEmail: response.from,
          lastMessageAt: response.receivedAt,
          hasUnread: true,
          messageCount: "1",
          createdAt: new Date(),
          updatedAt: new Date()
        });
    }
  } catch (error) {
    console.error("[Email Response Action] Error updating thread:", error);
    // Don't throw - just log the error
  }
}

/**
 * Process a new email notification from Gmail webhook
 */
export async function processIncomingEmailAction(
  userId: string,
  historyId: string
): Promise<ActionState<EmailResponse[]>> {
  console.log(`[Email Response Action] Processing incoming email for user ${userId}`);
  
  // Use the email response handler to process the email
  return processIncomingEmail(userId, historyId);
}

/**
 * Get responses for a specific thread
 */
export async function getThreadResponsesAction(
  userId: string,
  threadId: string
): Promise<ActionState<SelectEmailResponse[]>> {
  console.log(`[Email Response Action] Getting responses for thread ${threadId}`);
  
  try {
    const responses = await db.select()
      .from(emailResponsesTable)
      .where(and(
        eq(emailResponsesTable.userId, userId),
        eq(emailResponsesTable.threadId, threadId)
      ))
      .orderBy(desc(emailResponsesTable.receivedAt));
    
    return {
      isSuccess: true,
      message: "Thread responses retrieved successfully",
      data: responses
    };
  } catch (error: any) {
    console.error("[Email Response Action] Error getting thread responses:", error);
    return {
      isSuccess: false,
      message: `Failed to get thread responses: ${error.message}`
    };
  }
}

/**
 * Mark a response as read
 */
export async function markResponseAsReadAction(
  responseId: string
): Promise<ActionState<void>> {
  console.log(`[Email Response Action] Marking response ${responseId} as read`);
  
  try {
    await db.update(emailResponsesTable)
      .set({ isRead: true, updatedAt: new Date() })
      .where(eq(emailResponsesTable.id, responseId));
    
    return {
      isSuccess: true,
      message: "Response marked as read",
      data: undefined
    };
  } catch (error: any) {
    console.error("[Email Response Action] Error marking response as read:", error);
    return {
      isSuccess: false,
      message: `Failed to mark response as read: ${error.message}`
    };
  }
}

/**
 * Get email response statistics
 */
export async function getResponseStatsAction(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ActionState<{
  total: number;
  byClassification: Record<string, number>;
  unread: number;
  needsFollowUp: number;
}>> {
  console.log(`[Email Response Action] Getting response stats for user ${userId}`);
  
  try {
    // Build query conditions
    let conditions = eq(emailResponsesTable.userId, userId);
    
    if (startDate) {
      conditions = and(
        conditions,
        gte(emailResponsesTable.receivedAt, startDate)
      );
    }
    
    if (endDate) {
      conditions = and(
        conditions,
        lte(emailResponsesTable.receivedAt, endDate)
      );
    }
    
    // Get all responses within the date range
    const responses = await db.select()
      .from(emailResponsesTable)
      .where(conditions);
    
    // Calculate statistics
    const stats = {
      total: responses.length,
      byClassification: {} as Record<string, number>,
      unread: responses.filter(r => !r.isRead).length,
      needsFollowUp: responses.filter(r => r.needsFollowUp).length
    };
    
    // Count by classification
    for (const response of responses) {
      const classification = response.classification || "unclassified";
      stats.byClassification[classification] = (stats.byClassification[classification] || 0) + 1;
    }
    
    return {
      isSuccess: true,
      message: "Response statistics generated successfully",
      data: stats
    };
  } catch (error: any) {
    console.error("[Email Response Action] Error getting response stats:", error);
    return {
      isSuccess: false,
      message: `Failed to get response statistics: ${error.message}`
    };
  }
} 