import { jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const businessProfilesTable = pgTable("business_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessName: text("business_name"),
  websiteUrl: text("website_url").notNull(),
  
  // Owner/Decision Maker Info
  ownerName: text("owner_name"),
  ownerTitle: text("owner_title"),
  ownerLinkedin: text("owner_linkedin"),
  ownerEmail: text("owner_email"),
  
  // Contact Info
  primaryEmail: text("primary_email"),
  alternativeEmails: jsonb("alternative_emails").$type<string[]>(),
  phoneNumber: text("phone_number"),
  address: text("address"),
  
  // Business Differentiators
  uniqueSellingPoints: jsonb("unique_selling_points").$type<string[]>(),
  specialties: jsonb("specialties").$type<string[]>(),
  awards: jsonb("awards").$type<string[]>(),
  yearEstablished: varchar("year_established", { length: 4 }),
  
  // Services & Features
  services: jsonb("services").$type<string[]>(),
  technologies: jsonb("technologies").$type<string[]>(),
  insurancesAccepted: jsonb("insurances_accepted").$type<string[]>(),
  certifications: jsonb("certifications").$type<string[]>(),
  affiliations: jsonb("affiliations").$type<string[]>(),
  
  // Social Proof
  testimonialHighlights: jsonb("testimonial_highlights").$type<string[]>(),
  socialMediaLinks: jsonb("social_media_links").$type<Record<string, string>>(),
  
  // Outreach Status
  outreachStatus: text("outreach_status").notNull().default("pending"),
  lastEmailSentAt: timestamp("last_email_sent_at"),
  emailHistory: jsonb("email_history").$type<Array<{
    subject: string;
    content: string;
    sentAt: string;
  }>>(),
  
  // Source Tracking
  sourceUrl: text("source_url"),
  sourceType: text("source_type"),
  
  // Metadata (following project rules)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
});

export type InsertBusinessProfile = typeof businessProfilesTable.$inferInsert;
export type SelectBusinessProfile = typeof businessProfilesTable.$inferSelect; 