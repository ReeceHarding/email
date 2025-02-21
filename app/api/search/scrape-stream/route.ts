"use server"

import { NextRequest } from 'next/server'
import { searchAndScrape } from '@/lib/search-and-scrape'

// Keep track of active connections
const activeConnections = new Set<ReadableStreamDefaultController>()

// Handle connection cleanup
function handleConnectionClose(controller: ReadableStreamDefaultController) {
  activeConnections.delete(controller)
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json()
    const { queries } = body

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return new Response('Missing or invalid queries', { status: 400 })
    }

    // Create a stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        activeConnections.add(controller)

        // Helper function to send SSE events
        function sendEvent(type: string, data: any) {
          const event = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(new TextEncoder().encode(event))
        }

        // Process each query
        async function processQueries() {
          try {
            for (const query of queries) {
              // Send query start event
              sendEvent('queryStart', { query })

              // Search and scrape for the query
              const results = await searchAndScrape(
                query,
                (data: any) => {
                  // Send business profile events as they come in
                  if (data.type === 'businessProfile') {
                    sendEvent('businessProfile', data.profile)
                  }
                },
                () => activeConnections.has(controller) // Check if connection is still active
              )

              // Send query complete event
              sendEvent('queryComplete', { query, results })
            }

            // Send done event
            sendEvent('done', { message: 'All queries processed' })
            controller.close()
          } catch (error) {
            console.error('Error processing queries:', error)
            controller.error(error)
          } finally {
            handleConnectionClose(controller)
          }
        }

        // Start processing queries
        processQueries()
      },
      cancel(controller: ReadableStreamDefaultController) {
        handleConnectionClose(controller)
      }
    })

    // Return the stream response with appropriate headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      }
    })
  } catch (error) {
    console.error('Error in scrape stream route:', error)
    return new Response('Internal server error', { status: 500 })
  }
} 