import { pgEnum, pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { businessProfilesTable } from "./business-profiles-schema";

// Create outreach status enum
export const outreachStatusEnum = pgEnum("outreach_status", [
  "not_started",
  "in_progress",
  "contacted",
  "responded",
  "converted"
]);

export const teamMembersTable = pgTable("team_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessProfileId: uuid("business_profile_id")
    .references(() => businessProfilesTable.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  role: text("role"),
  email: text("email"),
  phone: text("phone"),
  socialProfiles: jsonb("social_profiles").$type<Record<string, string>>(),
  researchNotes: text("research_notes"),
  outreachStatus: outreachStatusEnum("outreach_status").notNull().default("not_started"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
});

export type InsertTeamMember = typeof teamMembersTable.$inferInsert;
export type SelectTeamMember = typeof teamMembersTable.$inferSelect; 