import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const processedUrlsTable = pgTable('processed_urls', {
  url: text('url').primaryKey(),
  processedAt: timestamp('processed_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}); 