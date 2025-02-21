import { pgTable, serial, varchar, text, boolean, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core"
import { InferModel } from "drizzle-orm"

export const leadsTable = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    
    // Basic Info
    companyName: varchar("company_name", { length: 255 }),
    websiteUrl: varchar("website_url", { length: 500 }).notNull(),
    description: text("description"),
    industry: varchar("industry", { length: 255 }),
    yearFounded: varchar("year_founded", { length: 4 }),
    companySize: varchar("company_size", { length: 50 }),
    
    // Contact Info
    contactEmail: varchar("contact_email", { length: 255 }),
    phoneNumber: varchar("phone_number", { length: 50 }),
    address: text("address"),
    
    // Social Media
    linkedinUrl: varchar("linkedin_url", { length: 500 }),
    twitterUrl: varchar("twitter_url", { length: 500 }),
    facebookUrl: varchar("facebook_url", { length: 500 }),
    instagramUrl: varchar("instagram_url", { length: 500 }),
    
    // Team Information (stored as JSONB)
    founders: jsonb("founders"),
    teamMembers: jsonb("team_members"),
    
    // Additional Data
    discoveredEmails: jsonb("discovered_emails"), 
    scrapedPages: jsonb("scraped_pages"), 
    
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
)

export type Lead = InferModel<typeof leadsTable>
export type NewLead = InferModel<typeof leadsTable, "insert"> 