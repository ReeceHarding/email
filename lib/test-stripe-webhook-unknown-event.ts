import { POST, stripe, setStripe } from "@/app/api/stripe-webhook/route"
import { NextRequest } from "next/server"
import Stripe from "stripe"

// Mock Stripe webhook event with unknown type
const mockEvent: Stripe.Event = {
  id: "evt_test_123",
  object: "event",
  type: "unknown.event.type", // Unknown event type
  data: {
    object: {
      id: "test_123",
      object: "unknown"
    }
  },
  api_version: "2022-11-15",
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  pending_webhooks: 0,
  request: { id: "req_test_123", idempotency_key: "test_123" }
} as any

// Save original Stripe instance
const originalStripe = { ...stripe }

// Mock Stripe webhook signature verification
setStripe({
  webhooks: {
    constructEvent: () => mockEvent
  }
})

async function testWebhookUnknownEvent() {
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

    // Verify response - should still return 200 for unhandled event types
    if (res.status === 200 && responseText === "Webhook processed") {
      console.log("Test passed: Unknown event type handled correctly")
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
  testWebhookUnknownEvent()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error("Test failed:", error)
      process.exit(1)
    })
} 