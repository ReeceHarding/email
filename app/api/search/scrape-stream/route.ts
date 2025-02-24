"use server"

import { NextRequest } from 'next/server'
import { searchBusinessesWithBrave, BraveSearchResult } from "@/lib/search-and-scrape"
import { scrapeWebsite, ScrapeResult } from "@/lib/firecrawl"
import { checkQuota, incrementQuota } from "@/lib/search-utils"
import { logStream } from "@/lib/logs/log-stream"

// Keep track of active connections
const activeConnections = new Set<ReadableStreamDefaultController<Uint8Array>>()

function handleConnectionClose(controller: ReadableStreamDefaultController<Uint8Array>) {
  let removedClientId: string | undefined = undefined;
  for (const [id, client] of logStream.clients.entries()) {
    if (client.controller === controller) {
      removedClientId = id;
      break;
    }
  }
  if (removedClientId) {
    logStream.removeClient(removedClientId);
  }

  activeConnections.delete(controller);
  console.log("[SSE] Connection closed. Remaining connections:", activeConnections.size);
}

/**
 * GET /api/search/scrape-stream
 *   - This sets up an SSE connection to stream logs (and any other SSE events).
 *   - We patch console.log to forward all logs to SSE using logStream.
 */
export async function GET() {
  console.log("[SSE] Starting GET handler for scrape-stream SSE")
  
  // Start log patching if not started
  logStream.startPatching()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      try {
        console.log("[SSE] Initializing GET stream for scraping")
        activeConnections.add(controller)

        // Add this controller as SSE client for log stream
        const clientId = logStream.addClient(controller)
        console.log("[SSE] Active connections:", activeConnections.size)

        // Send initial connection event
        const connectEvent = `event: connect\ndata: ${JSON.stringify({ message: "Connected to SSE stream" })}\n\n`
        controller.enqueue(new TextEncoder().encode(connectEvent))
        console.log("[SSE] Sent initial connection event for scraping")
      } catch (err) {
        console.error("[SSE] Error in GET stream for queries:", err)
        for (const [id, ctrl] of logStream.clients.entries()) {
          if (ctrl.controller === controller) {
            logStream.removeClient(id)
            break
          }
        }
        controller.error(err)
      }
    },
    cancel(controller) {
      console.log("[SSE] Stream cancelled by client")
      handleConnectionClose(controller)
    }
  })

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    }
  })
}

/**
 * POST /api/search/scrape-stream
 *  - We do the actual search + scrape logic here. Then we push SSE events (including logs).
 */
export async function POST(req: NextRequest) {
  console.log("[SSE] Starting POST handler for scrape-stream")
  console.log("[SSE] Current active connections:", activeConnections.size)

  // Start patch if not started
  logStream.startPatching()

  try {
    const body = await req.json()
    const { queries } = body
    console.log("[SSE] Received queries:", queries)

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      console.error("[SSE] Invalid queries format:", queries)
      return new Response("Missing or invalid queries", { status: 400 })
    }

    // Check usage quota
    const canProceed = await checkQuota()
    if (!canProceed) {
      console.log("[SSE] Quota exceeded")
      return new Response("Monthly quota exceeded", { status: 429 })
    }

    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        console.log("[SSE] Creating POST stream, adding connection.")
        activeConnections.add(controller)
        const clientId = logStream.addClient(controller)

        console.log("[SSE] Active connections after POST:", activeConnections.size)

        function sendEvent(event: string, data: any) {
          try {
            const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
            controller.enqueue(new TextEncoder().encode(payload))
            console.log("[SSE] Emitted event:", event, data)
          } catch (err) {
            console.error("[SSE] Error sending SSE event:", err)
          }
        }

        async function processQueries() {
          console.log("[SSE] processQueries for user input:", queries)
          try {
            for (const query of queries) {
              if (!activeConnections.has(controller)) {
                console.log("[SSE] Controller no longer active, stopping processing")
                return
              }
              
              sendEvent("searchStart", { query })
              console.log("[SSE] Doing Brave search with query:", query)

              let results: any[] = []
              let retryCount = 0
              const maxRetries = 3

              // We attempt search with retries
              while (retryCount < maxRetries) {
                try {
                  results = await searchBusinessesWithBrave(query)
                  break
                } catch (err) {
                  console.error(`[SSE] Search attempt ${retryCount + 1} failed:`, err)
                  retryCount++
                  if (retryCount === maxRetries) {
                    throw err
                  }
                }
              }

              console.log(`[SSE] Found ${results.length} search results for query="${query}"`)
              
              // Only send the first result for testing
              if (results.length > 0) {
                const firstResult = results[0]
                if (!activeConnections.has(controller)) {
                  console.log("[SSE] Controller no longer active, stopping processing")
                  return
                }
                
                sendEvent("searchResult", {
                  title: firstResult.title,
                  url: firstResult.url
                })
              }
              sendEvent("searchComplete", { query, count: 1 })

              // Now only scrape the first result
              if (results.length > 0) {
                const r = results[0]
                if (!activeConnections.has(controller)) {
                  console.log("[SSE] Controller no longer active, stopping processing")
                  return
                }
                
                await incrementQuota()
                sendEvent("scrapeStart", { url: r.url })

                let scraped
                retryCount = 0
                while (retryCount < maxRetries) {
                  try {
                    scraped = await scrapeWebsite(r.url, { maxDepth: 1 })
                    break
                  } catch (err) {
                    console.error(`[SSE] Scrape attempt ${retryCount + 1} failed for ${r.url}:`, err)
                    retryCount++
                    if (retryCount === maxRetries) {
                      throw err
                    }
                  }
                }

                if (scraped && scraped.success && scraped.businessData) {
                  console.log("[SSE] Successfully scraped site:", r.url)
                  sendEvent("businessProfile", {
                    name: scraped.businessData.businessName || r.title || r.url,
                    website: scraped.businessData.website || r.url,
                    email: scraped.businessData.contactEmail,
                    description: scraped.businessData.description,
                    phone: scraped.businessData.phoneNumber,
                    socialLinks: scraped.businessData.socialMedia
                  })
                } else {
                  console.log("[SSE] Partial or error scraping:", r.url)
                  sendEvent("scrapeError", {
                    url: r.url,
                    message: scraped?.error?.message || "No success or missing data"
                  })
                }
                sendEvent("scrapeComplete", { url: r.url })
              }
            }
            
            // Only send done event and close if controller is still active
            if (activeConnections.has(controller)) {
              sendEvent("done", { message: "All queries processed" })
              console.log("[SSE] Done with all queries.")
              console.log("[SSE] Closing POST SSE after final messages")
              controller.close()
              handleConnectionClose(controller)
            }
          } catch (error) {
            console.error("[SSE] Error in processQueries:", error)
            if (activeConnections.has(controller)) {
              sendEvent("error", { message: String(error) })
              controller.close()
              handleConnectionClose(controller)
            }
          }
        }

        await processQueries()
      },
      cancel: (controller) => {
        console.log("[SSE] Stream cancelled in POST")
        handleConnectionClose(controller)
      }
    })

    console.log("[SSE] Returning POST stream response for /api/search/scrape-stream")
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      }
    })
  } catch (error: any) {
    console.error("[SSE] Error in scrape stream POST route:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
} 