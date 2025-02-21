"use server";

import { NextRequest } from "next/server";
import { generateSearchQueriesAction } from "@/actions/generate-search-queries";

const activeConnections = new Map<string, ReadableStreamDefaultController>();

/**
 * SSE route that:
 * 1. Receives JSON of { userPrompt: string }
 * 2. Streams progress events: "start", "thinking", "partial", "complete", "error"
 * 3. Returns final queries as "queries" event
 */
export async function GET() {
  console.log("[SSE] Starting GET handler for generate-queries-stream SSE");
  
  const stream = new ReadableStream({
    start(controller) {
      try {
        console.log("[SSE] Initializing GET stream for queries");
        const id = Math.random().toString(36).substring(7);
        activeConnections.set(id, controller);
        console.log("[SSE] Active connections:", activeConnections.size);
        
        controller.enqueue(
          new TextEncoder().encode(`event: connect\ndata: ${JSON.stringify({ message: "Connected to SSE stream" })}\n\n`)
        );
        console.log("[SSE] Sent initial connection event for queries");
      } catch (err) {
        console.error("[SSE] Error in GET stream for queries:", err);
        for (const [id, ctrl] of activeConnections.entries()) {
          if (ctrl === controller) {
            activeConnections.delete(id);
            break;
          }
        }
        controller.error(err);
      }
    },
    cancel(controller) {
      console.log("[SSE] Stream cancelled by client");
      for (const [id, ctrl] of activeConnections.entries()) {
        if (ctrl === controller) {
          activeConnections.delete(id);
          break;
        }
      }
      console.log("[SSE] Remaining active connections:", activeConnections.size);
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no"
    }
  });
}

function handleConnectionClose(id: string) {
  if (activeConnections.has(id)) {
    activeConnections.delete(id);
  }
}

export async function POST(req: NextRequest) {
  console.log("[SSE] Starting POST handler for generate-queries-stream");
  console.log("[SSE] Current active connections:", activeConnections.size);
  
  try {
    const body = await req.json();
    const userPrompt = body?.userPrompt as string | undefined;

    if (!userPrompt || typeof userPrompt !== "string" || userPrompt.trim().length === 0) {
      console.error("[SSE] Invalid user prompt provided:", body);
      return new Response("No valid userPrompt provided", { status: 400 });
    }

    console.log("[SSE] Processing userPrompt:", userPrompt);

    // Send events to all active connections
    for (const [id, controller] of activeConnections.entries()) {
      try {
        console.log("[SSE] Sending events to connection", id);
        
        function sendEvent(event: string, data: any) {
          try {
            const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            console.log("[SSE] Sending event:", event, data);
            controller.enqueue(new TextEncoder().encode(payload));
          } catch (err) {
            console.error("[SSE] Error sending query gen event:", err);
          }
        }

        // Send initial events
        sendEvent("start", { message: "Generating queries started", userPrompt });

        // Generate queries
        const result = await generateSearchQueriesAction(userPrompt);
        console.log("[SSE] Query generation result:", result);

        if (result.progress) {
          for (const step of result.progress) {
            sendEvent(step.type, { message: step.message, data: step.data });
          }
        }

        // Send final results
        if (result.queries) {
          sendEvent("queries", { queries: result.queries });
        }

        sendEvent("done", { message: "All query generation events sent" });
      } catch (err) {
        console.error("[SSE] Error processing for connection:", err);
        controller.error(err);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error: any) {
    console.error("[SSE] Error in query generation POST route:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
} 