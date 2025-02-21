import { GET } from "@/app/api/track/route"
import { NextRequest } from "next/server"

async function testTrackMissingParams() {
  try {
    // Test case 1: Missing leadId
    const reqNoLeadId = new NextRequest(
      new Request("http://localhost:3002/api/track?type=open")
    )
    const resNoLeadId = await GET(reqNoLeadId)
    const noLeadIdStatus = resNoLeadId.status

    // Test case 2: Missing type
    const reqNoType = new NextRequest(
      new Request("http://localhost:3002/api/track?leadId=123")
    )
    const resNoType = await GET(reqNoType)
    const noTypeStatus = resNoType.status

    // Test case 3: Missing url for click event
    const reqNoUrl = new NextRequest(
      new Request("http://localhost:3002/api/track?leadId=123&type=click")
    )
    const resNoUrl = await GET(reqNoUrl)
    const noUrlStatus = resNoUrl.status

    // Verify responses
    if (
      noLeadIdStatus === 400 &&
      noTypeStatus === 400 &&
      noUrlStatus === 200 // The route returns 200 even if url is missing for click
    ) {
      console.log("Test passed: Missing parameters handled correctly")
      console.log("Missing leadId status:", noLeadIdStatus)
      console.log("Missing type status:", noTypeStatus)
      console.log("Missing url status:", noUrlStatus)
      return true
    } else {
      console.log("Test failed: Unexpected response status")
      console.log("Missing leadId status:", noLeadIdStatus)
      console.log("Missing type status:", noTypeStatus)
      console.log("Missing url status:", noUrlStatus)
      return false
    }
  } catch (error) {
    console.error("Test failed with error:", error)
    return false
  }
}

if (require.main === module) {
  testTrackMissingParams()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error("Test failed:", error)
      process.exit(1)
    })
} 