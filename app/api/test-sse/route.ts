"use server"

import { NextRequest } from 'next/server'

// Keep track of active connections
const activeConnections = new Set<ReadableStreamDefaultController>()

export async function GET() {
  console.log("[TEST-SSE] Starting GET handler");
  
  const stream = new ReadableStream({
    start(controller) {
      try {
        console.log("[TEST-SSE] Initializing stream");
        activeConnections.add(controller);
        
        // Send initial connection event
        const connectEvent = `event: connect\ndata: ${JSON.stringify({ message: "Connected to test SSE stream" })}\n\n`;
        controller.enqueue(new TextEncoder().encode(connectEvent));

        // Send some test events
        let count = 0;
        const interval = setInterval(() => {
          if (count >= 5) {
            clearInterval(interval);
            const doneEvent = `event: done\ndata: ${JSON.stringify({ message: "Test complete" })}\n\n`;
            controller.enqueue(new TextEncoder().encode(doneEvent));
            controller.close();
            activeConnections.delete(controller);
            return;
          }

          const testEvent = `event: test\ndata: ${JSON.stringify({ count, message: "Test event " + count })}\n\n`;
          controller.enqueue(new TextEncoder().encode(testEvent));
          count++;
        }, 1000);

      } catch (err) {
        console.error("[TEST-SSE] Error:", err);
        activeConnections.delete(controller);
        controller.error(err);
      }
    },
    cancel() {
      console.log("[TEST-SSE] Stream cancelled");
      activeConnections.clear();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
} 