import { GET } from "@/app/api/auth/gmail/route"
import { NextRequest } from "next/server"

async function testMissingCode() {
  try {
    // Test request without code parameter
    const req = new NextRequest(
      new Request("http://localhost:3002/api/auth/gmail?state=test_user_123")
    )
    const res = await GET(req)
    const json = await res.json()

    // Verify response
    if (json.error === "Missing code" && res.status === 400) {
      console.log("Test passed: Missing code error handled correctly")
      console.log("Response:", json)
      return true
    } else {
      console.log("Test failed: Unexpected response")
      console.log("Response:", json)
      return false
    }
  } catch (error) {
    console.error("Test failed with error:", error)
    return false
  }
}

if (require.main === module) {
  testMissingCode()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error("Test failed:", error)
      process.exit(1)
    })
} 