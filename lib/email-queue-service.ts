/**
 * Email Queue Service
 * 
 * This service handles email queuing, scheduling, sending, and retrying.
 * It provides functionality to:
 * - Add emails to the queue
 * - Process the queue with rate limiting
 * - Implement retry logic with exponential backoff
 * - Track email status
 * - Monitor performance metrics
 */

import { db } from "@/db/db";
import { 
  emailQueueTable, 
  emailStatusEnum,
  emailPriorityEnum,
  InsertEmailQueue,
  SelectEmailQueue
} from "@/db/schema/email-queue-schema";
import { sendEmail } from "@/lib/gmail";
import { eq, and, lte, gte, desc, asc, SQL, or, sql, count } from "drizzle-orm";
import { ActionState } from "@/types";

// Constants for queue processing
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BATCH_SIZE = 10;
const MIN_RETRY_DELAY_MS = 60 * 1000; // 1 minute
const MAX_RETRY_DELAY_MS = 4 * 60 * 60 * 1000; // 4 hours
const RATE_LIMIT_EMAILS_PER_DAY = 500; // Default rate limit

// Performance metrics
let queueSize = 0;
let processingTime = 0;
let successRate = 1.0; // Start at 100%
let lastProcessedAt: Date | null = null;

/**
 * Add an email to the sending queue
 */
export async function addToEmailQueue({
  userId,
  emailId,
  to,
  subject,
  body,
  cc,
  bcc,
  replyTo,
  priority = "normal",
  scheduledFor,
  maxAttempts = DEFAULT_MAX_RETRIES
}: {
  userId: string;
  emailId?: string;
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  priority?: "high" | "normal" | "low";
  scheduledFor?: Date;
  maxAttempts?: number;
}): Promise<ActionState<SelectEmailQueue>> {
  try {
    console.log(`[Email Queue] Adding email to queue for user ${userId}`);
    
    const queueItem: InsertEmailQueue = {
      userId,
      emailId: emailId || undefined,
      to,
      subject,
      body,
      cc: cc || undefined,
      bcc: bcc || undefined,
      replyTo: replyTo || undefined,
      status: scheduledFor && scheduledFor > new Date() ? "scheduled" : "queued",
      priority: priority as any, // Type assertion needed due to enum
      scheduledFor: scheduledFor || undefined,
      attempts: 0,
      maxAttempts,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const [newQueueItem] = await db.insert(emailQueueTable)
      .values(queueItem)
      .returning();
    
    // Update queue size metric
    await updateQueueSizeMetric();
    
    return {
      isSuccess: true,
      message: "Email added to queue successfully",
      data: newQueueItem
    };
  } catch (error: any) {
    console.error("[Email Queue] Error adding email to queue:", error);
    return {
      isSuccess: false,
      message: `Failed to add email to queue: ${error.message}`
    };
  }
}

/**
 * Process the email queue, sending emails and handling retries
 */
export async function processEmailQueue(
  batchSize = DEFAULT_BATCH_SIZE
): Promise<ActionState<{ processed: number; successful: number; failed: number }>> {
  console.log("[Email Queue] Starting queue processing");
  const startTime = Date.now();
  
  try {
    // Get emails that are ready to be processed
    // This includes:
    // 1. Queued emails
    // 2. Scheduled emails whose scheduled time has passed
    // 3. Retrying emails whose next attempt time has passed
    const now = new Date();

    // Build the complex where condition
    const whereCondition = and(
      or(
        eq(emailQueueTable.status, "queued"),
        and(
          eq(emailQueueTable.status, "scheduled"),
          lte(emailQueueTable.scheduledFor as any, now)
        ),
        and(
          eq(emailQueueTable.status, "retrying"),
          lte(emailQueueTable.nextAttemptAt as any, now)
        )
      ),
      lte(emailQueueTable.attempts, emailQueueTable.maxAttempts)
    );
    
    const queueItems = await db.select()
      .from(emailQueueTable)
      .where(whereCondition)
      .orderBy(
        asc(emailQueueTable.priority),
        asc(emailQueueTable.createdAt)
      )
      .limit(batchSize);
    
    console.log(`[Email Queue] Found ${queueItems.length} emails to process`);
    
    if (queueItems.length === 0) {
      return {
        isSuccess: true,
        message: "No emails to process",
        data: { processed: 0, successful: 0, failed: 0 }
      };
    }
    
    // Process each email
    let successful = 0;
    let failed = 0;
    
    for (const queueItem of queueItems) {
      // Update status to processing
      await db.update(emailQueueTable)
        .set({ 
          status: "processing",
          updatedAt: new Date()
        })
        .where(eq(emailQueueTable.id, queueItem.id));
      
      try {
        console.log(`[Email Queue] Processing email ${queueItem.id}`);
        
        // Send the email
        const { threadId, messageId } = await sendEmail({
          userId: queueItem.userId,
          to: queueItem.to ?? "",
          subject: queueItem.subject ?? "",
          body: queueItem.body ?? "",
          cc: queueItem.cc ?? undefined,
          bcc: queueItem.bcc ?? undefined
        });
        
        // Update status to sent
        await db.update(emailQueueTable)
          .set({ 
            status: "sent",
            attempts: queueItem.attempts + 1,
            lastAttemptAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(emailQueueTable.id, queueItem.id));
        
        successful++;
        console.log(`[Email Queue] Successfully sent email ${queueItem.id}`);
      } catch (error: any) {
        console.error(`[Email Queue] Error sending email ${queueItem.id}:`, error);
        
        // Increment attempt count
        const newAttemptCount = queueItem.attempts + 1;
        
        // Determine if we should retry
        if (newAttemptCount < queueItem.maxAttempts) {
          // Calculate backoff time with exponential increase
          // Formula: min(maxDelay, minDelay * 2^attempt)
          const delayMs = Math.min(
            MAX_RETRY_DELAY_MS,
            MIN_RETRY_DELAY_MS * Math.pow(2, queueItem.attempts)
          );
          const nextAttemptAt = new Date(Date.now() + delayMs);
          
          // Update for retry
          await db.update(emailQueueTable)
            .set({
              status: "retrying",
              attempts: newAttemptCount,
              lastAttemptAt: new Date(),
              nextAttemptAt,
              lastError: error.message.substring(0, 1000), // Truncate if too long
              updatedAt: new Date()
            })
            .where(eq(emailQueueTable.id, queueItem.id));
          
          console.log(`[Email Queue] Scheduled retry for email ${queueItem.id} at ${nextAttemptAt}`);
        } else {
          // Max retries reached, mark as failed
          await db.update(emailQueueTable)
            .set({
              status: "failed",
              attempts: newAttemptCount,
              lastAttemptAt: new Date(),
              lastError: error.message.substring(0, 1000), // Truncate if too long
              updatedAt: new Date()
            })
            .where(eq(emailQueueTable.id, queueItem.id));
          
          console.log(`[Email Queue] Email ${queueItem.id} failed permanently after ${newAttemptCount} attempts`);
        }
        
        failed++;
      }
    }
    
    // Update metrics
    const endTime = Date.now();
    updateProcessingMetrics(startTime, endTime, successful, failed);
    await updateQueueSizeMetric();
    
    return {
      isSuccess: true,
      message: `Processed ${queueItems.length} emails (${successful} successful, ${failed} failed)`,
      data: {
        processed: queueItems.length,
        successful,
        failed
      }
    };
    
  } catch (error: any) {
    console.error("[Email Queue] Error processing queue:", error);
    
    // Still update metrics on error
    const endTime = Date.now();
    updateProcessingMetrics(startTime, endTime, 0, 0);
    
    return {
      isSuccess: false,
      message: `Failed to process email queue: ${error.message}`
    };
  }
}

/**
 * Get email queue metrics
 */
export async function getEmailQueueMetrics(): Promise<ActionState<{
  queueSize: number;
  processingTime: number;
  successRate: number;
  lastProcessedAt: Date | null;
  statusCounts: Record<string, number>;
}>> {
  try {
    // Get counts by status for detailed metrics
    const statusCounts: Record<string, number> = {};
    const statuses = ["queued", "scheduled", "processing", "sent", "delivered", "failed", "bounced", "retrying"];
    
    for (const status of statuses) {
      const countResult = await db
        .select({ value: count() })
        .from(emailQueueTable)
        .where(eq(emailQueueTable.status, status as any));
      
      statusCounts[status] = countResult[0]?.value || 0;
    }
    
    return {
      isSuccess: true,
      message: "Email queue metrics retrieved successfully",
      data: {
        queueSize,
        processingTime,
        successRate,
        lastProcessedAt,
        statusCounts
      }
    };
  } catch (error: any) {
    console.error("[Email Queue] Error getting metrics:", error);
    return {
      isSuccess: false,
      message: `Failed to get email queue metrics: ${error.message}`
    };
  }
}

/**
 * Get details for a specific email in the queue
 */
export async function getEmailQueueItem(
  id: string
): Promise<ActionState<SelectEmailQueue>> {
  try {
    const queueItems = await db
      .select()
      .from(emailQueueTable)
      .where(eq(emailQueueTable.id, id))
      .limit(1);
    
    const queueItem = queueItems[0];
    
    if (!queueItem) {
      return {
        isSuccess: false,
        message: `Email queue item with ID ${id} not found`
      };
    }
    
    return {
      isSuccess: true,
      message: "Email queue item retrieved successfully",
      data: queueItem
    };
  } catch (error: any) {
    console.error(`[Email Queue] Error getting queue item ${id}:`, error);
    return {
      isSuccess: false,
      message: `Failed to get email queue item: ${error.message}`
    };
  }
}

// Helper function to update queue size metric
async function updateQueueSizeMetric() {
  try {
    // Count all items in the queue that aren't in terminal states
    const activeStatesCondition = or(
      eq(emailQueueTable.status, "queued"),
      eq(emailQueueTable.status, "scheduled"),
      eq(emailQueueTable.status, "processing"),
      eq(emailQueueTable.status, "retrying")
    );
    
    const result = await db
      .select({ value: count() })
      .from(emailQueueTable)
      .where(activeStatesCondition);
    
    queueSize = result[0]?.value || 0;
  } catch (error) {
    console.error("[Email Queue] Error updating queue size metric:", error);
  }
}

// Helper function to update processing metrics
function updateProcessingMetrics(
  startTime: number,
  endTime: number,
  successful: number,
  total: number
) {
  // Update processing time (moving average)
  const newProcessingTime = endTime - startTime;
  processingTime = processingTime === 0 
    ? newProcessingTime 
    : (processingTime * 0.7) + (newProcessingTime * 0.3);
  
  // Update success rate if we processed any emails
  if (total > 0) {
    const newSuccessRate = successful / total;
    successRate = (successRate * 0.7) + (newSuccessRate * 0.3);
  }
  
  // Update last processed timestamp
  lastProcessedAt = new Date();
} 