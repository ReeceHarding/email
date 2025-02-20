"use server"

import { NextRequest } from "next/server"
import { searchAndScrape } from "@/lib/search-and-scrape"

/**
 * SSE route that:
 * 1. Receives JSON of { queries: string[] }
 * 2. For each query:
 *    a) We call searchAndScrape(query). This returns multiple websites.
 *    b) For each website, we parse the resulting business info and store it in DB.
 *    c) We stream an SSE "businessProfile" event for each new business found.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const queries = body?.queries as string[] | undefined
    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return new Response("No queries provided", { status: 400 })
    }

    // Prepare the ReadableStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        // Helper: send an SSE message
        function sendEvent(event: string, data: any) {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(new TextEncoder().encode(payload))
        }

        // We'll go query by query
        for (const query of queries) {
          // Announce we're starting the query
          sendEvent("queryStart", { query })

          try {
            // searchAndScrape returns multiple websites with their business info
            const searchResults = await searchAndScrape(query)
            
            // Send each business profile as an event
            for (const result of searchResults) {
              sendEvent("businessProfile", {
                website_url: result.url,
                business_name: result.businessInfo.name || "(no name)",
                ...result.businessInfo
              })
            }

            // Announce query done
            sendEvent("queryComplete", { query })
          } catch (err: any) {
            console.error(`Error scraping query "${query}":`, err)
            sendEvent("queryError", { query, message: err.message })
          }
        }

        // All done
        sendEvent("done", { message: "All queries processed" })
        controller.close()
      }
    })

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive"
      }
    })
  } catch (error: any) {
    console.error("Error in SSE route:", error)
    return new Response("Internal Server Error", { status: 500 })
  }
} 