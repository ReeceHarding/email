import { db } from "@/db/db"
import { usersTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { recordLeadUsage, stripe } from "./stripe"

// Mock Stripe client
const originalStripeSubscriptionsRetrieve = stripe.subscriptions.retrieve
stripe.subscriptions.retrieve = async () => ({
  id: "test_sub_123",
  items: {
    data: [{
      id: "test_item_123",
      price: {
        id: "price_test_123"
      }
    }]
  }
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

async function testRecordLeadUsageMissingPrice() {
  try {
    // Create test user first
    await setupTestUser()

    // Save current metered price ID and remove it
    const originalMeteredPriceId = process.env.STRIPE_METERED_PRICE_ID
    delete process.env.STRIPE_METERED_PRICE_ID

    try {
      // Attempt to record usage (should fail)
      await recordLeadUsage(TEST_USER.clerkId)

      console.log("Test failed: Expected error was not thrown")
      return false
    } catch (error) {
      // Verify error message
      if (error instanceof Error && error.message === "No metered price ID set in environment (STRIPE_METERED_PRICE_ID).") {
        console.log("Test passed: Missing metered price ID error handled correctly")
        console.log("Error:", error.message)
        return true
      } else {
        console.log("Test failed: Unexpected error message")
        console.log("Error:", error)
        return false
      }
    } finally {
      // Restore metered price ID if it existed
      if (originalMeteredPriceId) {
        process.env.STRIPE_METERED_PRICE_ID = originalMeteredPriceId
      }
    }
  } catch (error) {
    console.error("Test failed with error:", error)
    return false
  } finally {
    // Restore original Stripe implementation
    stripe.subscriptions.retrieve = originalStripeSubscriptionsRetrieve

    // Clean up test user
    await db.delete(usersTable)
      .where(eq(usersTable.clerkId, TEST_USER.clerkId))
  }
}

if (require.main === module) {
  testRecordLeadUsageMissingPrice()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error("Test failed:", error)
      process.exit(1)
    })
} 