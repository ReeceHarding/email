import { pgTable, serial, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";

export const businessProfiles = pgTable("business_profiles", {
  id: serial("id").primaryKey(),
  
  // Basic Info
  businessName: varchar("business_name", { length: 255 }),
  websiteUrl: varchar("website_url", { length: 500 }).notNull(),
  
  // Owner/Decision Maker Info
  ownerName: varchar("owner_name", { length: 255 }),
  ownerTitle: varchar("owner_title", { length: 255 }),
  ownerLinkedin: varchar("owner_linkedin", { length: 500 }),
  ownerEmail: varchar("owner_email", { length: 255 }),
  
  // Contact Info
  primaryEmail: varchar("primary_email", { length: 255 }),
  alternativeEmails: jsonb("alternative_emails"), // Array of other found emails
  phoneNumber: varchar("phone_number", { length: 50 }),
  address: text("address"),
  
  // Business Differentiators
  uniqueSellingPoints: jsonb("unique_selling_points"), // Array of what makes them special
  specialties: jsonb("specialties"), // Array of specialties
  awards: jsonb("awards"), // Array of awards/recognitions
  yearEstablished: varchar("year_established", { length: 4 }),
  
  // Services & Features
  services: jsonb("services"), // Array of services
  technologies: jsonb("technologies"), // Array of special technologies/equipment
  insurancesAccepted: jsonb("insurances_accepted"), // Array of accepted insurances
  
  // Professional Info
  certifications: jsonb("certifications"), // Array of certifications
  affiliations: jsonb("affiliations"), // Array of professional affiliations
  
  // Social Proof
  testimonialHighlights: jsonb("testimonial_highlights"), // Array of notable testimonials
  socialMediaLinks: jsonb("social_media_links"), // Object of platform -> URL
  
  // Outreach Status
  outreachStatus: varchar("outreach_status", { length: 50 }).default("pending").notNull(),
  lastEmailSentAt: timestamp("last_email_sent_at"),
  emailHistory: jsonb("email_history"), // Array of previous email attempts
  
  // Source Tracking
  sourceUrl: varchar("source_url", { length: 500 }), // URL where we found them
  sourceType: varchar("source_type", { length: 50 }), // e.g., "search", "referral", etc.
  
  // Metadata
  scrapedAt: timestamp("scraped_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  notes: text("notes") // Any additional observations
}); 