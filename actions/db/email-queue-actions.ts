"use server"

/**
 * Email Queue Server Actions
 * 
 * This file contains server actions for interacting with the email queue.
 * These actions provide a server-side API for email sending and queue management.
 */

import { ActionState } from "@/types";
import { 
  addToEmailQueue, 
  processEmailQueue, 
  getEmailQueueMetrics,
  getEmailQueueItem 
} from "@/lib/email-queue-service";
import { SelectEmailQueue } from "@/db/schema/email-queue-schema";

/**
 * Add an email to the sending queue
 */
export async function addToQueueAction({
  userId,
  emailId,
  to,
  subject,
  body,
  cc,
  bcc,
  replyTo,
  priority,
  scheduledFor,
  maxAttempts
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
  console.log("[Email Queue Action] Adding email to queue for user", userId);
  
  return addToEmailQueue({
    userId,
    emailId,
    to,
    subject,
    body,
    cc,
    bcc,
    replyTo,
    priority,
    scheduledFor,
    maxAttempts
  });
}

/**
 * Process emails in the queue
 */
export async function processQueueAction(
  batchSize?: number
): Promise<ActionState<{ processed: number; successful: number; failed: number }>> {
  console.log("[Email Queue Action] Processing email queue");
  
  return processEmailQueue(batchSize);
}

/**
 * Get email queue metrics
 */
export async function getQueueMetricsAction(): Promise<ActionState<{
  queueSize: number;
  processingTime: number;
  successRate: number;
  lastProcessedAt: Date | null;
  statusCounts: Record<string, number>;
}>> {
  console.log("[Email Queue Action] Getting email queue metrics");
  
  return getEmailQueueMetrics();
}

/**
 * Get details for a specific email in the queue
 */
export async function getQueueItemAction(
  id: string
): Promise<ActionState<SelectEmailQueue>> {
  console.log(`[Email Queue Action] Getting queue item ${id}`);
  
  return getEmailQueueItem(id);
} 