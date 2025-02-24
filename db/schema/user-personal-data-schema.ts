/**
 * @file user-personal-data-schema.ts
 * @description
 * This file defines the schema for storing user personal data or user background information.
 * It serves as a place to hold additional personalized info about the user, such as their
 * education, interests, professional background, and other personal notes.
 *
 * Key features:
 * - Column for storing a userId (references Clerk user).
 * - Columns for storing personal data, e.g. education, hobbies, location, etc.
 * - Timestamps for record management (createdAt, updatedAt).
 *
 * @notes
 * - The table is named user_personal_data.
 * - We reference this table when personalizing outreach by matching user backgrounds to leads.
 */

import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { InferModel } from "drizzle-orm";

/**
 * The user_personal_data table schema.
 * Stores a user's personal background info for better personalization in outreach.
 */
export const userPersonalDataTable = pgTable("user_personal_data", {
  /**
   * UUID primary key.
   * defaultRandom() automatically generates a version-4 UUID on insert.
   */
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * The Clerk user ID who owns this personal data.
   * For references, you can also reference usersTable if needed,
   * but we can store the raw clerkId here for simplicity.
   */
  userId: text("user_id").notNull(),

  /**
   * The user's education background info, e.g. "Went to University of Wisconsin".
   */
  education: text("education"),

  /**
   * The user's hobbies or personal interests. For example: "fishing, coding, soccer".
   */
  hobbies: text("hobbies"),

  /**
   * The city or region the user is located in, e.g. "Chicago, IL".
   */
  location: text("location"),

  /**
   * Additional personal notes that the user wants to store about themselves.
   */
  notes: text("notes"),

  /**
   * Timestamps for record creation and updates.
   * defaultNow() sets a default of the current timestamp on insert.
   * $onUpdate(() => new Date()) updates the updatedAt column automatically on record updates.
   */
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

/**
 * InsertUserPersonalData is the type used when inserting a record into user_personal_data.
 */
export type InsertUserPersonalData = InferModel<typeof userPersonalDataTable, "insert">;

/**
 * SelectUserPersonalData is the type returned when selecting from user_personal_data.
 */
export type SelectUserPersonalData = InferModel<typeof userPersonalDataTable, "select">; 