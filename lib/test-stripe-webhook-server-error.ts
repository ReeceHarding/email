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

// Save original Stripe instance and db functions
const originalStripe = { ...stripe }
const originalDbUpdate = db.update

// Mock Stripe webhook signature verification
setStripe({
  webhooks: {
    constructEvent: () => mockEvent
  }
})

// Mock db update to throw an error
db.update = () => {
  throw new Error("Database error")
}

async function testWebhookServerError() {
  try {
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
    if (res.status === 500 && responseText === "Webhook error") {
      console.log("Test passed: Server error handled correctly")
      console.log("Response:", responseText)
      return true
    } else {
      console.log("Test failed: Unexpected response")
      console.log("Response:", responseText)
      return false
    }
  } catch (error) {
    console.error("Test failed with error:", error)
    return false
  } finally {
    // Restore original implementations
    setStripe(originalStripe)
    db.update = originalDbUpdate
  }
}

if (require.main === module) {
  testWebhookServerError()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error("Test failed:", error)
      process.exit(1)
    })
} 