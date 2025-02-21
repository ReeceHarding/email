import { pgTable, serial, varchar, timestamp } from "drizzle-orm/pg-core"
import { InferModel } from "drizzle-orm"

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  gmailAccessToken: varchar("gmail_access_token", { length: 2000 }),
  gmailRefreshToken: varchar("gmail_refresh_token", { length: 2000 }),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

export type User = InferModel<typeof usersTable>
export type NewUser = InferModel<typeof usersTable, "insert"> 