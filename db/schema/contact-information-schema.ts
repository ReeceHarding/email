/**
 * @file contact-information-schema.ts
 * @description
 * This file defines the database schema for contact information storage.
 * It includes tables for various contact methods (email, phone, social media, etc.)
 * that can be associated with leads or team members.
 */

import { pgEnum, pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { leadsTable } from "./leads-schema";
import { teamMembersTable } from "./team-members-schema";

// Define the contact type enum
export const contactTypeEnum = pgEnum("contact_type", [
  "email",
  "phone",
  "linkedin",
  "twitter",
  "facebook",
  "other"
]);

// Define the contact source enum (where we got this contact info)
export const contactSourceEnum = pgEnum("contact_source", [
  "website",
  "linkedin",
  "twitter",
  "facebook",
  "research",
  "manual",
  "other"
]);

export const contactInformationTable = pgTable("contact_information", {
  id: uuid("id").defaultRandom().primaryKey(),
  
  // Can be associated with either a lead or team member (one will be null)
  leadId: uuid("lead_id").references(() => leadsTable.id, { onDelete: "cascade" }),
  teamMemberId: uuid("team_member_id").references(() => teamMembersTable.id, { onDelete: "cascade" }),
  
  // Contact details
  type: contactTypeEnum("type").notNull(),
  value: text("value").notNull(), // The actual email, phone number, or username/URL
  source: contactSourceEnum("source").notNull(),
  
  // Verification/validation status
  isVerified: boolean("is_verified").default(false),
  verificationDate: timestamp("verification_date"),
  
  // Metadata
  primary: boolean("primary").default(false), // Is this the primary contact method
  notes: text("notes"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export type InsertContactInformation = typeof contactInformationTable.$inferInsert;
export type SelectContactInformation = typeof contactInformationTable.$inferSelect; 