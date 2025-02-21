import { pgTable, serial, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core"
import { InferModel } from "drizzle-orm"

export const emailsTable = pgTable("emails", {
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
})

export type Email = InferModel<typeof emailsTable>
export type NewEmail = InferModel<typeof emailsTable, "insert"> 