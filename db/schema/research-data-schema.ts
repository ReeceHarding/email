/**
 * @file research-data-schema.ts
 * @description
 * This file defines the database schema for storing research data about leads,
 * businesses, and team members. This includes information gathered through
 * scraping, API calls, and AI analysis.
 */

import { pgEnum, pgTable, text, timestamp, uuid, jsonb, boolean } from "drizzle-orm/pg-core";
import { leadsTable } from "./leads-schema";
import { businessProfilesTable } from "./business-profiles-schema";
import { teamMembersTable } from "./team-members-schema";

// Define the research type enum
export const researchTypeEnum = pgEnum("research_type", [
  "company_info",
  "person_info",
  "social_media",
  "news",
  "job_history",
  "interests",
  "pain_points",
  "technology_stack",
  "other"
]);

// Define the research source enum
export const researchSourceEnum = pgEnum("research_source", [
  "website",
  "linkedin",
  "twitter",
  "news_article",
  "job_posting",
  "ai_analysis",
  "manual",
  "other"
]);

export const researchDataTable = pgTable("research_data", {
  id: uuid("id").defaultRandom().primaryKey(),
  
  // Can be associated with a lead, business, or team member (at least one must be set)
  leadId: uuid("lead_id").references(() => leadsTable.id, { onDelete: "cascade" }),
  businessProfileId: uuid("business_profile_id").references(() => businessProfilesTable.id, { onDelete: "cascade" }),
  teamMemberId: uuid("team_member_id").references(() => teamMembersTable.id, { onDelete: "cascade" }),
  
  // Research details
  type: researchTypeEnum("type").notNull(),
  source: researchSourceEnum("source").notNull(),
  sourceUrl: text("source_url"),
  
  // Research content
  title: text("title").notNull(),
  description: text("description"),
  content: text("content"), // For text-based research
  structuredData: jsonb("structured_data"), // For more complex structured data
  
  // Metadata
  confidence: text("confidence"), // Low, Medium, High
  relevance: text("relevance"), // Low, Medium, High
  verified: boolean("verified").default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export type InsertResearchData = typeof researchDataTable.$inferInsert;
export type SelectResearchData = typeof researchDataTable.$inferSelect; 