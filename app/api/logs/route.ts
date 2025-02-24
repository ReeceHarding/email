import { NextRequest, NextResponse } from "next/server"

// Force Next.js to treat this as a dynamic route (allows stable serverless usage).
export const dynamic = "force-dynamic"

/**
 * POST /api/logs
 * Example usage from the frontend: `fetch("/api/logs", { method: "POST", body: JSON.stringify(...) })`
 */
export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text()
    console.log("[/api/logs] Received POST request with raw body:", bodyText)

    // Attempt to parse JSON
    let body: any = {}
    try {
      body = JSON.parse(bodyText)
    } catch (error) {
      console.log("[/api/logs] Body is not valid JSON:", error)
    }

    // Show a nice console log message
    console.log("[/api/logs] Final parsed body:", body)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[/api/logs] Error handling log:", error)
    return NextResponse.json({ error: "Failed to handle log" }, { status: 500 })
  }
} 