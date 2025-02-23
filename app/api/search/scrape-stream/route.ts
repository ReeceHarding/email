"use server"

import { NextRequest } from 'next/server'
import { searchAndScrape } from '@/lib/search-and-scrape'

// Keep track of active connections
const activeConnections = new Set<ReadableStreamDefaultController>()

// Handle connection cleanup
function handleConnectionClose(controller: ReadableStreamDefaultController) {
  activeConnections.delete(controller)
}

export async function GET() {
  console.log("[SSE] Starting GET handler for scrape-stream SSE");
  
  const stream = new ReadableStream({
    start(controller) {
      try {
        console.log("[SSE] Initializing GET stream for scraping");
        const id = Math.random().toString(36).substring(7);
        activeConnections.add(controller);
        console.log("[SSE] Active connections:", activeConnections.size);
        
        // Send initial connection event
        const connectEvent = `event: connect\ndata: ${JSON.stringify({ message: "Connected to SSE stream", id })}\n\n`;
        controller.enqueue(new TextEncoder().encode(connectEvent));
        console.log("[SSE] Sent initial connection event for scraping");
      } catch (err) {
        console.error("[SSE] Error in GET stream for scraping:", err);
        activeConnections.delete(controller);
        const errorEvent = `event: error\ndata: ${JSON.stringify({ message: "Failed to initialize SSE connection" })}\n\n`;
        controller.enqueue(new TextEncoder().encode(errorEvent));
        controller.error(err);
      }
    },
    cancel(controller) {
      console.log("[SSE] Stream cancelled by client");
      activeConnections.delete(controller);
      console.log("[SSE] Remaining active connections:", activeConnections.size);
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}

export async function POST(request: NextRequest) {
  console.log("[SSE] Starting POST handler for scrape-stream");
  try {
    // Parse the request body
    const body = await request.json();
    const { queries } = body;
    console.log("[SSE] Received queries:", queries);

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      console.error("[SSE] Invalid queries format:", queries);
      return new Response('Missing or invalid queries', { status: 400 });
    }

    // Create a stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        activeConnections.add(controller);
        console.log("[SSE] Active connections after POST:", activeConnections.size);

        // Helper function to send SSE events with error handling
        function sendEvent(type: string, data: any) {
          try {
            const eventStr = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
            console.log("[SSE] Sending event:", { type, data });
            controller.enqueue(new TextEncoder().encode(eventStr));
          } catch (err) {
            console.error("[SSE] Error sending event:", { type, data, error: err });
            const errorEvent = `event: error\ndata: ${JSON.stringify({ message: "Failed to send event" })}\n\n`;
            controller.enqueue(new TextEncoder().encode(errorEvent));
          }
        }

        // Process each query
        async function processQueries() {
          try {
            for (const query of queries) {
              console.log("[SSE] Processing query:", query);
              
              // Send query start event
              sendEvent('queryStart', { query });

              // Search and scrape for the query
              const results = await searchAndScrape(
                query,
                (data: any) => {
                  // Send business profile events as they come in
                  if (data.type === 'businessProfile') {
                    console.log("[SSE] Business profile found:", data.profile);
                    sendEvent('businessProfile', data.profile);
                  }
                },
                () => {
                  const isActive = activeConnections.has(controller);
                  console.log("[SSE] Connection status check:", { isActive });
                  return isActive;
                }
              );

              // Send query complete event
              sendEvent('queryComplete', { query, results });
            }

            // Send done event
            sendEvent('done', { message: 'All queries processed' });
            controller.close();
          } catch (error) {
            console.error("[SSE] Error processing queries:", error);
            sendEvent('error', { 
              message: error instanceof Error ? error.message : 'Error processing queries'
            });
          } finally {
            handleConnectionClose(controller);
          }
        }

        // Start processing queries
        processQueries().catch(error => {
          console.error("[SSE] Unhandled error in processQueries:", error);
          sendEvent('error', { 
            message: error instanceof Error ? error.message : 'Unhandled error in query processing'
          });
          handleConnectionClose(controller);
        });
      },
      cancel(controller) {
        console.log("[SSE] Stream cancelled in POST");
        handleConnectionClose(controller);
      }
    });

    // Return the stream response with appropriate headers
    console.log("[SSE] Returning POST stream response");
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    });
  } catch (error) {
    console.error("[SSE] Error in scrape stream POST route:", error);
    return new Response(
      JSON.stringify({ 
        message: error instanceof Error ? error.message : 'Internal server error'
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
} 