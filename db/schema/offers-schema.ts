import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core"
import { businessProfilesTable } from "./business-profiles-schema"

export const offersTable = pgTable("offers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  businessProfileId: uuid("business_profile_id")
    .references(() => businessProfilesTable.id, { onDelete: "cascade" })
    .notNull(),
  
  // Core Offer Components
  dreamOutcome: text("dream_outcome").notNull(),
  perceivedLikelihood: text("perceived_likelihood").notNull(),
  timeDelay: text("time_delay").notNull(),
  effortAndSacrifice: text("effort_and_sacrifice").notNull(),
  
  // Value Equation Components
  valueEquation: jsonb("value_equation").$type<{
    likedFeatures: string[];
    lackingFeatures: string[];
    uniqueAdvantages: string[];
  }>(),
  
  // Offer Elements
  coreService: text("core_service").notNull(),
  bonuses: jsonb("bonuses").$type<string[]>(),
  guarantee: text("guarantee").notNull(),
  pricing: jsonb("pricing").$type<{
    amount: number;
    currency: string;
    billingFrequency?: string;
    setupFee?: number;
  }>(),
  
  // Scarcity/Urgency
  scarcityElements: jsonb("scarcity_elements").$type<{
    type: "time" | "quantity" | "both";
    deadline?: string;
    spots?: number;
  }>(),
  
  // Final Pitch
  shortPitch: text("short_pitch").notNull(),
  longPitch: text("long_pitch").notNull(),
  
  // Metadata
  status: text("status").notNull().default("draft"),
  version: text("version").notNull().default("1.0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
})

export type InsertOffer = typeof offersTable.$inferInsert
export type SelectOffer = typeof offersTable.$inferSelect 