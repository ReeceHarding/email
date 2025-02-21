import { POST } from "@/app/api/stripe-webhook/route"
import { NextRequest } from "next/server"
import { Headers } from "next/dist/compiled/@edge-runtime/primitives"

async function testWebhookSignature() {
  try {
    // Test case 1: Missing signature header
    const reqNoSignature = new NextRequest(
      new Request("http://localhost:3002/api/stripe-webhook", {
        method: "POST",
        body: JSON.stringify({ test: "data" })
      })
    )
    const resNoSignature = await POST(reqNoSignature)
    const responseText = await resNoSignature.text()
    
    // Verify response
    if (
      resNoSignature.status === 400 &&
      responseText === "Missing Stripe signature header"
    ) {
      console.log("Test passed: Missing signature header handled correctly")
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
  }
}

if (require.main === module) {
  testWebhookSignature()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error("Test failed:", error)
      process.exit(1)
    })
} 