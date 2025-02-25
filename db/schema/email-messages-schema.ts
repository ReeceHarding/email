/**
 * @file email-messages-schema.ts
 * @description
 * This file defines the database schema for email messages.
 * These are individual emails that are part of a campaign, with their content,
 * personalization data, and tracking information.
 */

import { pgEnum, pgTable, text, timestamp, uuid, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { emailCampaignsTable } from "./email-campaigns-schema";
import { leadsTable } from "./leads-schema";

// Define the message status enum
export const messageStatusEnum = pgEnum("message_status", [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "replied",
  "bounced",
  "failed"
]);

// Define the message type enum
export const messageTypeEnum = pgEnum("message_type", [
  "initial",
  "follow_up",
  "custom"
]);

export const emailMessagesTable = pgTable("email_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  
  // Linked campaign and recipient
  campaignId: uuid("campaign_id").references(() => emailCampaignsTable.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id").references(() => leadsTable.id, { onDelete: "cascade" }),
  
  // Message details
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  type: messageTypeEnum("type").notNull(),
  status: messageStatusEnum("status").notNull().default("draft"),
  
  // Personalization data
  personalizedValues: jsonb("personalized_values"), // JSON with personalized data
  
  // Tracking and metrics
  messageId: text("message_id"), // External ID from email provider
  threadId: text("thread_id"), // External thread ID for conversation tracking
  
  // Email tracking
  isOpened: boolean("is_opened").default(false),
  openedAt: timestamp("opened_at"),
  openCount: integer("open_count").default(0),
  
  isClicked: boolean("is_clicked").default(false),
  clickedAt: timestamp("clicked_at"),
  clickCount: integer("click_count").default(0),
  clickData: jsonb("click_data"), // Information about what links were clicked
  
  hasReplied: boolean("has_replied").default(false),
  repliedAt: timestamp("replied_at"),
  
  // Error handling
  deliveryError: text("delivery_error"),
  errorDetails: jsonb("error_details"),
  
  // Timestamps
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export type InsertEmailMessage = typeof emailMessagesTable.$inferInsert;
export type SelectEmailMessage = typeof emailMessagesTable.$inferSelect; 