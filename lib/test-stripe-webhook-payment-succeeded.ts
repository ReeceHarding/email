import { POST, stripe, setStripe } from "@/app/api/stripe-webhook/route"
import { NextRequest } from "next/server"
import { db } from "@/db/db"
import { usersTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import Stripe from "stripe"

// Mock Stripe webhook event
const mockEvent: Stripe.Event = {
  id: "evt_test_123",
  object: "event",
  type: "invoice.payment_succeeded",
  data: {
    object: {
      id: "in_test_123",
      object: "invoice",
      customer: "cus_test_123",
      subscription: "sub_test_123"
    } as Stripe.Invoice
  },
  api_version: "2022-11-15",
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  pending_webhooks: 0,
  request: { id: "req_test_123", idempotency_key: "test_123" }
}

// Save original Stripe instance
const originalStripe = { ...stripe }

// Mock Stripe webhook signature verification
setStripe({
  webhooks: {
    constructEvent: () => mockEvent
  }
})

const TEST_USER = {
  clerkId: "test_user_123",
  email: "test@example.com",
  stripeCustomerId: "cus_test_123"
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

async function testWebhookPaymentSucceeded() {
  try {
    // Create test user first
    await setupTestUser()

    // Create webhook request
    const req = new NextRequest(
      new Request("http://localhost:3002/api/stripe-webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "test_signature_123"
        },
        body: JSON.stringify(mockEvent)
      })
    )

    // Process webhook
    const res = await POST(req)
    const responseText = await res.text()

    // Verify response
    if (res.status === 200 && responseText === "Webhook processed") {
      // Verify database update
      const user = await db.query.users.findFirst({
        where: eq(usersTable.clerkId, TEST_USER.clerkId)
      })

      if (
        user?.stripeSubscriptionId === "sub_test_123" &&
        user?.stripeCustomerId === "cus_test_123"
      ) {
        console.log("Test passed: Payment succeeded webhook handled correctly")
        console.log("User updated:", user)
        return true
      } else {
        console.log("Test failed: User not updated correctly")
        console.log("User:", user)
        return false
      }
    } else {
      console.log("Test failed: Unexpected response")
      console.log("Response:", responseText)
      return false
    }
  } catch (error) {
    console.error("Test failed with error:", error)
    return false
  } finally {
    // Restore original Stripe implementation
    setStripe(originalStripe)

    // Clean up test user
    await db.delete(usersTable)
      .where(eq(usersTable.clerkId, TEST_USER.clerkId))
  }
}

if (require.main === module) {
  testWebhookPaymentSucceeded()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error("Test failed:", error)
      process.exit(1)
    })
} 