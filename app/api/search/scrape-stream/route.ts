"use server"

import { NextRequest } from 'next/server'
import { searchBusinessesWithBrave, BraveSearchResult } from "@/lib/search-and-scrape"
import { scrapeWebsite, ScrapeResult } from "@/lib/firecrawl"
import { checkQuota, incrementQuota } from "@/lib/search-utils"
import { logStream } from "@/lib/logs/log-stream"
import { createBusinessProfile } from "@/actions/db/business-profiles-actions"
import { BusinessInfo } from "@/lib/test-scrape-system"

// Keep track of active connections
const activeConnections = new Set<ReadableStreamDefaultController<Uint8Array>>()

function handleConnectionClose(controller: ReadableStreamDefaultController<Uint8Array>) {
  console.log("[SSE DEBUG] handleConnectionClose called")
  let removedClientId: string | undefined = undefined;
  for (const [id, client] of logStream.clients.entries()) {
    if (client.controller === controller) {
      removedClientId = id;
      console.log("[SSE DEBUG] Found client to remove:", id)
      break;
    }
  }
  if (removedClientId) {
    console.log("[SSE DEBUG] Removing client:", removedClientId)
    logStream.removeClient(removedClientId);
  }

  activeConnections.delete(controller);
  console.log("[SSE DEBUG] Connection closed. Active connections:", {
    size: activeConnections.size,
    logStreamClients: logStream.clients.size
  });
}

/**
 * GET /api/search/scrape-stream
 *   - This sets up an SSE connection to stream logs (and any other SSE events).
 *   - We patch console.log to forward all logs to SSE using logStream.
 */
export async function GET() {
  console.log("[SSE DEBUG] Starting GET handler")
  console.log("[SSE DEBUG] Current active connections:", {
    size: activeConnections.size,
    logStreamClients: logStream.clients.size
  })
  
  logStream.startPatching()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      try {
        console.log("[SSE DEBUG] Initializing GET stream")
        activeConnections.add(controller)

        const clientId = logStream.addClient(controller)
        console.log("[SSE DEBUG] Added new client:", {
          id: clientId,
          activeConnections: activeConnections.size,
          logStreamClients: logStream.clients.size
        })

        const connectEvent = `event: connect\ndata: ${JSON.stringify({ message: "Connected to SSE stream" })}\n\n`
        controller.enqueue(new TextEncoder().encode(connectEvent))
        console.log("[SSE DEBUG] Sent initial connection event")
      } catch (err) {
        console.error("[SSE DEBUG] Error in GET stream initialization:", err)
        handleConnectionClose(controller)
        controller.error(err)
      }
    },
    cancel(controller) {
      console.log("[SSE DEBUG] Stream cancelled by client")
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
  console.log("[SSE DEBUG] Starting POST handler")
  console.log("[SSE DEBUG] Current active connections:", {
    size: activeConnections.size,
    logStreamClients: logStream.clients.size
  })

  logStream.startPatching()

  try {
    const body = await req.json()
    const { queries } = body
    console.log("[SSE DEBUG] Received queries:", queries)

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      console.error("[SSE DEBUG] Invalid queries format:", queries)
      return new Response("Missing or invalid queries", { status: 400 })
    }

    const canProceed = await checkQuota()
    if (!canProceed) {
      console.log("[SSE DEBUG] Quota exceeded")
      return new Response("Monthly quota exceeded", { status: 429 })
    }

    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        console.log("[SSE DEBUG] Creating POST stream")
        activeConnections.add(controller)
        const clientId = logStream.addClient(controller)
        console.log("[SSE DEBUG] Added POST stream client:", {
          id: clientId,
          activeConnections: activeConnections.size,
          logStreamClients: logStream.clients.size
        })

        function sendEvent(event: string, data: any) {
          try {
            console.log("[SSE DEBUG] Sending event:", { type: event, data })
            const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
            controller.enqueue(new TextEncoder().encode(payload))
          } catch (err) {
            console.error("[SSE DEBUG] Error sending event:", { type: event, error: err })
          }
        }

        async function processQueries() {
          console.log("[SSE DEBUG] Starting processQueries")
          try {
            for (const query of queries) {
              if (!activeConnections.has(controller)) {
                console.log("[SSE DEBUG] Controller no longer active, stopping processing")
                return
              }
              
              console.log("[SSE DEBUG] Processing query:", query)
              sendEvent("searchStart", { query })

              let results: any[] = []
              let retryCount = 0
              const maxRetries = 3

              while (retryCount < maxRetries) {
                try {
                  console.log("[SSE DEBUG] Attempting search, try:", retryCount + 1)
                  results = await searchBusinessesWithBrave(query)
                  console.log("[SSE DEBUG] Search successful, results:", results.length)
                  break
                } catch (err) {
                  console.error(`[SSE DEBUG] Search attempt ${retryCount + 1} failed:`, err)
                  retryCount++
                  if (retryCount === maxRetries) throw err
                }
              }

              if (results.length > 0) {
                const firstResult = results[0]
                console.log("[SSE DEBUG] Processing first result:", firstResult)
                
                if (!activeConnections.has(controller)) {
                  console.log("[SSE DEBUG] Controller lost during result processing")
                  return
                }
                
                sendEvent("searchResult", {
                  title: firstResult.title,
                  url: firstResult.url
                })

                await incrementQuota()
                sendEvent("scrapeStart", { url: firstResult.url })

                let scraped
                retryCount = 0
                while (retryCount < maxRetries) {
                  try {
                    console.log("[SSE DEBUG] Attempting scrape, try:", retryCount + 1)
                    scraped = await scrapeWebsite(firstResult.url, { maxDepth: 1 })
                    console.log("[SSE DEBUG] Scrape successful:", scraped)
                    break
                  } catch (err) {
                    console.error(`[SSE DEBUG] Scrape attempt ${retryCount + 1} failed:`, err)
                    retryCount++
                    if (retryCount === maxRetries) throw err
                  }
                }

                if (scraped?.success && scraped?.businessData) {
                  console.log("[SSE DEBUG] Preparing business profile data")
                  
                  // Transform social media links to expected format
                  const socialLinks = scraped.businessData.socialMedia ? 
                    Object.entries(scraped.businessData.socialMedia)
                      .filter(([_, url]) => url)
                      .reduce((acc: Record<string, string>, [platform, url]) => {
                        acc[platform.toLowerCase()] = url as string;
                        return acc;
                      }, {}) : undefined;
                  
                  const websiteUrl = scraped.businessData.website || firstResult.url;
                  
                  const businessProfile: BusinessInfo = {
                    name: scraped.businessData.businessName || firstResult.title || firstResult.url,
                    website: websiteUrl,
                    email: scraped.businessData.contactEmail,
                    description: scraped.businessData.description,
                    phone: scraped.businessData.phoneNumber,
                    socialLinks
                  }
                  console.log("[SSE DEBUG] Sending business profile:", businessProfile)
                  sendEvent("businessProfile", businessProfile)

                  // Add database operation
                  try {
                    console.log("[SSE DEBUG] Attempting to create business profile in database")
                    const dbResult = await createBusinessProfile(
                      websiteUrl,
                      businessProfile,
                      firstResult.url,
                      'search'
                    )
                    console.log("[SSE DEBUG] Database operation result:", dbResult)
                    
                    if (dbResult.success) {
                      sendEvent("dbSuccess", { message: "Business profile saved to database" })
                    } else {
                      console.error("[SSE DEBUG] Failed to save to database:", dbResult.message)
                      sendEvent("dbError", { message: dbResult.message })
                    }
                  } catch (err) {
                    console.error("[SSE DEBUG] Database operation error:", err)
                    sendEvent("dbError", { message: "Failed to save business profile to database" })
                  }
                } else {
                  console.log("[SSE DEBUG] Scrape unsuccessful or missing data:", {
                    success: scraped?.success,
                    error: scraped?.error
                  })
                  sendEvent("scrapeError", {
                    url: firstResult.url,
                    message: scraped?.error?.message || "No success or missing data"
                  })
                }
                sendEvent("scrapeComplete", { url: firstResult.url })
              }
              
              sendEvent("searchComplete", { query, count: 1 })
            }
            
            if (activeConnections.has(controller)) {
              console.log("[SSE DEBUG] All queries processed, sending done event")
              sendEvent("done", { message: "All queries processed" })
              console.log("[SSE DEBUG] Closing POST stream")
              controller.close()
              handleConnectionClose(controller)
            }
          } catch (error) {
            console.error("[SSE DEBUG] Error in processQueries:", error)
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
        console.log("[SSE DEBUG] POST stream cancelled")
        handleConnectionClose(controller)
      }
    })

    console.log("[SSE DEBUG] Returning POST stream response")
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
    console.error("[SSE DEBUG] Error in POST handler:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
} 