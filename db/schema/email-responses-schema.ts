import { pgEnum, pgTable, text, timestamp, uuid, boolean, jsonb, real } from "drizzle-orm/pg-core";
import { emailsTable } from "./emails-schema";

// Email response classification enum
export const responseClassificationEnum = pgEnum("response_classification", [
  "positive",         // Interested, want to learn more
  "negative",         // Not interested, do not contact
  "question",         // Has questions needing answers
  "meeting",          // Wants to schedule a meeting
  "referral",         // Referring to someone else
  "out_of_office",    // Out of office reply
  "other"             // Other type of response
]);

// Email responses table
export const emailResponsesTable = pgTable("email_responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  
  // Message identifiers
  messageId: text("message_id").notNull().unique(),
  threadId: text("thread_id").notNull(),
  originalEmailId: text("original_email_id").references(() => emailsTable.id),
  
  // Sender and recipient
  from: text("from").notNull(),
  to: text("to").notNull(),
  
  // Content
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  
  // Analysis and classification
  classification: responseClassificationEnum("classification"),
  confidence: real("confidence"),
  keyPoints: jsonb("key_points"),
  
  // Status fields
  isRead: boolean("is_read").default(false).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  needsFollowUp: boolean("needs_follow_up").default(false),
  
  // Timestamps
  receivedAt: timestamp("received_at").notNull(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
});

// Email Thread table for tracking conversation history
export const emailThreadsTable = pgTable("email_threads", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  
  // Gmail thread identifier
  threadId: text("thread_id").notNull().unique(),
  
  // Thread information
  subject: text("subject").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name"),
  
  // Thread status
  status: text("status").notNull().default("active"),  // active, closed, archived
  lastMessageAt: timestamp("last_message_at").notNull(),
  messageCount: text("message_count").notNull().default("1"),
  hasUnread: boolean("has_unread").default(false).notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
});

// Types for ORM
export type InsertEmailResponse = typeof emailResponsesTable.$inferInsert;
export type SelectEmailResponse = typeof emailResponsesTable.$inferSelect;

export type InsertEmailThread = typeof emailThreadsTable.$inferInsert;
export type SelectEmailThread = typeof emailThreadsTable.$inferSelect; 