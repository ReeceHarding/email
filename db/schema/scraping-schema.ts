import { pgTable, serial, varchar, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
import { InferModel } from "drizzle-orm";

export const scrapedPages = pgTable("scraped_pages", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  url: text("url").notNull(),
  rawData: jsonb("raw_data"),
  processedData: jsonb("processed_data"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export type ScrapedPage = InferModel<typeof scrapedPages>;

export const scrapeMetrics = pgTable("scrape_metrics", {
  id: serial("id").primaryKey(),
  jobId: varchar("job_id", { length: 255 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  baseUrl: text("base_url").notNull(),
  pagesScraped: integer("pages_scraped").default(0).notNull(),
  durationMs: integer("duration_ms"),
  status: varchar("status", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export type ScrapeMetric = InferModel<typeof scrapeMetrics>; 