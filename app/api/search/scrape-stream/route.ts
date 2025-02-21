import { NextRequest, NextResponse } from "next/server"
import { searchBusinessesWithBrave } from "@/lib/search-and-scrape"

export const config = {
  runtime: 'nodejs',
  dynamic: 'force-dynamic'
};

interface Connection {
  writer: WritableStreamDefaultWriter<any>;
  isActive: boolean;
}

interface StreamController {
  connectionId?: string;
  signal?: { aborted: boolean };
  enqueue: (chunk: any) => void;
  close: () => void;
  error: (error: Error) => void;
}

interface ProgressData {
  type?: 'searchStart' | 'searchComplete' | 'searchResult' | 'scrapeError';
  query?: string;
  count?: number;
  url?: string;
  success?: boolean;
  message?: string;
  title?: string;
  description?: string;
  results?: Array<{ url: string; title: string }>;
}

const activeConnections = new Map<number, Connection>();
let connectionCounter = 0;

function createStreamHandler(prefix: string = '[SSE-DEBUG]') {
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const sendEvent = async (event: string, data: any) => {
    try {
      const formattedData = JSON.stringify(data);
      console.log(`${prefix} Sending event: ${event}`, {
        data: formattedData.substring(0, 200) + '...' // Truncate for logging
      });
      
      const message = `event: ${event}\ndata: ${formattedData}\n\n`;
      await writer.write(encoder.encode(message));
    } catch (error) {
      console.error(`${prefix} Error sending event:`, {
        event,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  };

  return {
    stream,
    writer,
    sendEvent,
    getResponse: () => new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  };
}

export async function GET() {
  console.log('[BACKEND-DEBUG] SSE route handler started');
  const { stream, writer, sendEvent, getResponse } = createStreamHandler('[BACKEND-DEBUG]');

  // Start the search process in the background
  (async () => {
    console.log('[BACKEND-DEBUG] Starting background search process');
    try {
      const results = await searchBusinessesWithBrave(
        'dentist',
        (event: string, data: any) => {
          console.log('[BACKEND-DEBUG] Progress callback received:', { event, data });
          sendEvent(event, data).catch(error => {
            console.error('[BACKEND-DEBUG] Error in progress callback:', error);
          });
        }
      );
      
      console.log('[BACKEND-DEBUG] Search completed successfully:', results);
      await sendEvent('complete', { type: 'searchComplete', message: 'Search completed', results });
    } catch (error) {
      console.error('[BACKEND-DEBUG] Unhandled error in search process:', error);
      if (error instanceof Error) {
        await sendEvent('error', { type: 'scrapeError', message: error.message });
      } else {
        await sendEvent('error', { type: 'scrapeError', message: 'Unhandled error in search process' });
      }
    } finally {
      await writer.close();
    }
  })();

  console.log('[BACKEND-DEBUG] Returning SSE response');
  return getResponse();
}

export async function POST(req: NextRequest) {
  const { searchQuery } = await req.json();
  const { stream, writer, sendEvent, getResponse } = createStreamHandler();

  console.log('[SSE-DEBUG] Starting POST handler with query:', searchQuery);

  try {
    // Track this connection
    connectionCounter++;
    activeConnections.set(connectionCounter, {
      writer,
      isActive: true
    });

    console.log('[SSE-DEBUG] Connection setup:', {
      connectionId: connectionCounter,
      activeConnections: activeConnections.size
    });

    // Process the query
    console.log('[SSE-DEBUG] Starting search and scrape for query:', searchQuery);
    
    await searchBusinessesWithBrave(
      searchQuery,
      (event: string, data: any) => {
        console.log('[SSE-DEBUG] Progress callback received:', {
          event,
          data: data ? Object.keys(data) : 'no data'
        });
        sendEvent(event, data).catch(error => {
          console.error('[SSE-DEBUG] Error in progress callback:', error);
        });
      }
    );

    console.log('[SSE-DEBUG] Search and scrape completed');
    await sendEvent('complete', { message: 'Processing completed' });

  } catch (error) {
    console.error('[SSE-DEBUG] Fatal error in POST handler:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    try {
      await sendEvent('error', {
        message: 'An error occurred while processing the request',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch (e) {
      console.error('[SSE-DEBUG] Error sending error event:', e);
    }
  } finally {
    try {
      await writer.close();
    } catch (e) {
      console.error('[SSE-DEBUG] Error closing writer:', e);
    }
  }

  return getResponse();
} 