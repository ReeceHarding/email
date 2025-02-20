import { pgTable, serial, text, varchar, boolean, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { InferModel } from "drizzle-orm";

// 1) USERS
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
export type User = InferModel<typeof users>;

// 2) LEADS
export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    
    // Basic Info
    companyName: varchar("company_name", { length: 255 }),
    websiteUrl: varchar("website_url", { length: 500 }).notNull(),
    description: text("description"),
    
    // Contact Info
    contactName: varchar("contact_name", { length: 255 }),
    contactEmail: varchar("contact_email", { length: 255 }),
    phoneNumber: varchar("phone_number", { length: 50 }),
    address: text("address"),
    
    // Social Media
    linkedinUrl: varchar("linkedin_url", { length: 500 }),
    twitterUrl: varchar("twitter_url", { length: 500 }),
    facebookUrl: varchar("facebook_url", { length: 500 }),
    instagramUrl: varchar("instagram_url", { length: 500 }),
    
    // Business Hours (keep as JSON since it's structured data)
    businessHours: jsonb("business_hours"),
    
    // Status and Metadata
    status: varchar("status", { length: 50 }).default("pending").notNull(),
    requiresHuman: boolean("requires_human").default(false).notNull(),
    billed: boolean("billed").default(false).notNull(),
    lastScrapedAt: timestamp("last_scraped_at"),
    
    // Raw Data (keep for reference/debugging)
    rawScrapedData: jsonb("raw_scraped_data"),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (table) => ({
    userWebsiteIdx: uniqueIndex("user_website_idx").on(table.userId, table.websiteUrl)
  })
);
export type Lead = InferModel<typeof leads>;

// 3) EMAILS
export const emails = pgTable("emails", {
  id: serial("id").primaryKey(),
  leadId: varchar("lead_id", { length: 255 }).notNull(),
  direction: varchar("direction", { length: 50 }).notNull(), // 'outbound' or 'inbound'
  content: text("content").notNull(),
  threadId: varchar("thread_id", { length: 255 }),
  messageId: varchar("message_id", { length: 255 }),
  isDraft: boolean("is_draft").default(false).notNull(),
  needsApproval: boolean("needs_approval").default(false).notNull(),
  sentAt: timestamp("sent_at"),
  receivedAt: timestamp("received_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
export type Email = InferModel<typeof emails>; 