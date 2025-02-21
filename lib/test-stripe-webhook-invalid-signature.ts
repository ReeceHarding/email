import { POST, stripe, setStripe } from "@/app/api/stripe-webhook/route"
import { NextRequest } from "next/server"
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

// Mock Stripe webhook signature verification to throw an error
setStripe({
  webhooks: {
    constructEvent: () => {
      throw new Error("Invalid signature")
    }
  }
})

async function testWebhookInvalidSignature() {
  try {
    // Create webhook request
    const req = new NextRequest(
      new Request("http://localhost:3002/api/stripe-webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "invalid_signature_123"
        },
        body: JSON.stringify(mockEvent)
      })
    )

    // Process webhook
    const res = await POST(req)
    const responseText = await res.text()

    // Verify response
    if (res.status === 400 && responseText === "Invalid signature") {
      console.log("Test passed: Invalid signature handled correctly")
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
    // Restore original Stripe implementation
    setStripe(originalStripe)
  }
}

if (require.main === module) {
  testWebhookInvalidSignature()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error("Test failed:", error)
      process.exit(1)
    })
} 