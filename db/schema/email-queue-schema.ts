import { pgEnum, pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { emailsTable } from "./emails-schema";

// Define an enum for email status
export const emailStatusEnum = pgEnum("email_status", [
  "queued",      // Initial state when added to queue
  "scheduled",   // Scheduled for future delivery
  "processing",  // Currently being processed for sending
  "sent",        // Successfully sent
  "delivered",   // Confirmed delivered (if tracking available)
  "failed",      // Failed to send
  "bounced",     // Bounced after sending
  "retrying"     // Failed but will be retried
]);

// Define an enum for email priority
export const emailPriorityEnum = pgEnum("email_priority", [
  "high",
  "normal",
  "low"
]);

export const emailQueueTable = pgTable("email_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  emailId: text("email_id").references(() => emailsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  
  // Email details (if not linked to an email record)
  to: text("to"),
  cc: text("cc"),
  bcc: text("bcc"),
  subject: text("subject"),
  body: text("body"),
  replyTo: text("reply_to"),
  
  // Queue and status information
  status: emailStatusEnum("status").default("queued").notNull(),
  priority: emailPriorityEnum("priority").default("normal").notNull(),
  scheduledFor: timestamp("scheduled_for"),
  
  // Retry information
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(5).notNull(),
  lastAttemptAt: timestamp("last_attempt_at"),
  nextAttemptAt: timestamp("next_attempt_at"),
  
  // Error tracking
  lastError: text("last_error"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export type InsertEmailQueue = typeof emailQueueTable.$inferInsert;
export type SelectEmailQueue = typeof emailQueueTable.$inferSelect; 