import { db } from "@/db/db"
import { usersTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { recordLeadUsage, stripe } from "./stripe"

// Set required environment variable
const TEST_METERED_PRICE_ID = "price_test_123"
process.env.STRIPE_METERED_PRICE_ID = TEST_METERED_PRICE_ID

// Mock Stripe client
const originalStripeSubscriptionsRetrieve = stripe.subscriptions.retrieve
const originalStripeSubscriptionItemsCreateUsageRecord = stripe.subscriptionItems.createUsageRecord

stripe.subscriptions.retrieve = async () => ({
  id: "test_sub_123",
  items: {
    data: [{
      id: "test_item_123",
      price: {
        id: TEST_METERED_PRICE_ID
      }
    }]
  }
}) as any

stripe.subscriptionItems.createUsageRecord = async () => ({
  id: "test_usage_123"
}) as any

const TEST_USER = {
  clerkId: "test_user_123",
  email: "test@example.com",
  stripeSubscriptionId: "test_sub_123"
}

async function setupTestUser() {
  try {
    // Delete existing test user if any
    await db.delete(usersTable)
      .where(eq(usersTable.clerkId, TEST_USER.clerkId))

    // Create new test user
    const [user] = await db.insert(usersTable)
      .values(TEST_USER)
      .returning()

    console.log("Test user created:", user)
    return user
  } catch (error) {
    console.error("Error setting up test user:", error)
    throw error
  }
}

async function testRecordLeadUsage() {
  try {
    // Create test user first
    await setupTestUser()

    // Test recording usage
    await recordLeadUsage(TEST_USER.clerkId)
    console.log("Test passed: Lead usage recorded successfully")
    return true
  } catch (error) {
    console.error("Test failed with error:", error)
    return false
  } finally {
    // Restore original Stripe implementations
    stripe.subscriptions.retrieve = originalStripeSubscriptionsRetrieve
    stripe.subscriptionItems.createUsageRecord = originalStripeSubscriptionItemsCreateUsageRecord

    // Clean up test user
    await db.delete(usersTable)
      .where(eq(usersTable.clerkId, TEST_USER.clerkId))

    // Clean up environment variable
    delete process.env.STRIPE_METERED_PRICE_ID
  }
}

if (require.main === module) {
  testRecordLeadUsage()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error("Test failed:", error)
      process.exit(1)
    })
} 