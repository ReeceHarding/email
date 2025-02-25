/**
 * @file email-campaigns-schema.ts
 * @description
 * This file defines the database schema for email campaigns.
 * Email campaigns represent a series of related emails sent to prospects
 * for a specific marketing or sales purpose.
 */

import { pgEnum, pgTable, text, timestamp, uuid, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users-schema";

// Define the campaign status enum
export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "active",
  "paused",
  "completed",
  "archived"
]);

// Define the campaign type enum
export const campaignTypeEnum = pgEnum("campaign_type", [
  "cold_outreach",
  "follow_up",
  "newsletter",
  "announcement",
  "re_engagement",
  "custom"
]);

export const emailCampaignsTable = pgTable("email_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  
  // User who owns this campaign
  userId: text("user_id").notNull().references(() => usersTable.userId),
  
  // Campaign details
  name: text("name").notNull(),
  description: text("description"),
  type: campaignTypeEnum("type").notNull(),
  status: campaignStatusEnum("status").notNull().default("draft"),
  
  // Campaign configuration
  sendingSchedule: jsonb("sending_schedule"), // JSON configuration for scheduling
  targetAudience: jsonb("target_audience"), // JSON for targeting rules
  personalizedFields: jsonb("personalized_fields"), // JSON list of fields to personalize
  
  // Campaign metrics
  totalRecipients: integer("total_recipients").default(0),
  totalSent: integer("total_sent").default(0),
  totalOpened: integer("total_opened").default(0),
  totalClicked: integer("total_clicked").default(0),
  totalReplied: integer("total_replied").default(0),
  
  // Automation settings
  autoFollowUp: boolean("auto_follow_up").default(false),
  followUpDelay: integer("follow_up_delay"), // Delay in hours
  maxFollowUps: integer("max_follow_ups").default(0),
  
  // Template identifiers for the emails in this campaign
  emailTemplates: jsonb("email_templates"), // Array of template IDs
  
  // Timestamps
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export type InsertEmailCampaign = typeof emailCampaignsTable.$inferInsert;
export type SelectEmailCampaign = typeof emailCampaignsTable.$inferSelect; 