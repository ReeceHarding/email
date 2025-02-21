"use client"

import { useState, useRef, useEffect } from "react"
import { generateSearchQueriesAction } from "@/actions/generate-search-queries"

interface ProgressItem {
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  timestamp: Date;
}

/**
 * This page allows the user to:
 * 1. Enter an overall prompt to generate search queries
 *    - Now done via SSE using /api/search/generate-queries-stream
 * 2. Edit/approve queries
 * 3. Click "Run Scrape" to do SSE streaming from the server
 * 4. Watch new business profiles appear live
 */
export default function LeadFinderPage() {
  const [promptInput, setPromptInput] = useState("")
  const [queries, setQueries] = useState<string[]>([])
  const [isPending, setIsPending] = useState(false)
  const [isScraping, setIsScraping] = useState(false)
  const [progress, setProgress] = useState<ProgressItem[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)

  /**
   * SSE-based approach to generate queries.
   * Replaces the old generateSearchQueriesAction direct call so we can stream progress.
   */
  async function handleGenerate() {
    if (!promptInput.trim()) {
      addProgressItem('error', 'Please enter a prompt first')
      return
    }

    // Clear existing state
    setQueries([])
    setProgress([])
    setIsPending(true)

    try {
      // Create new SSE connection
      eventSourceRef.current = new EventSource("/api/search/generate-queries-stream")

      // Onopen
      eventSourceRef.current.onopen = async () => {
        console.log("[Client] SSE connection for generate queries opened")

        // Now that it's open, we do a POST fetch to actually start generation
        const response = await fetch("/api/search/generate-queries-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userPrompt: promptInput })
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`Failed to start query generation: ${error}`)
        }
      }

      // On message
      eventSourceRef.current.onmessage = (event: MessageEvent) => {
        try {
          console.log("[Client] Received default message from query SSE:", event.data)
          const data = JSON.parse(event.data)
          addProgressItem('info', data.message || `Message: ${event.data}`)
        } catch (err) {
          console.warn("[Client] Failed to parse message event data:", err)
          addProgressItem('info', `Message: ${event.data}`)
        }
      }

      // Custom events
      eventSourceRef.current.addEventListener("connect", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          console.log("[Client] Query SSE connect:", data)
          addProgressItem('info', data.message)
        } catch (err) {
          console.warn("[Client] Failed to parse connect event data:", err)
          addProgressItem('info', "Connected to query generation")
        }
      })

      eventSourceRef.current.addEventListener("start", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          console.log("[Client] Query SSE start:", data)
          addProgressItem('info', data.message)
        } catch (err) {
          console.warn("[Client] Failed to parse start event data:", err)
          addProgressItem('info', "Started query generation")
        }
      })

      eventSourceRef.current.addEventListener("thinking", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          console.log("[Client] Query SSE thinking:", data)
          addProgressItem('info', data.message, data.data)
        } catch (err) {
          console.warn("[Client] Failed to parse thinking event data:", err)
          addProgressItem('info', "Processing query generation")
        }
      })

      eventSourceRef.current.addEventListener("complete", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          console.log("[Client] Query SSE complete:", data)
          addProgressItem('success', data.message)
        } catch (err) {
          console.warn("[Client] Failed to parse complete event data:", err)
          addProgressItem('success', "Query generation complete")
        }
      })

      eventSourceRef.current.addEventListener("error", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          console.error("[Client] Query SSE error:", data)
          addProgressItem('error', data.message, data)
        } catch (err) {
          console.warn("[Client] Failed to parse error event data:", err)
          addProgressItem('error', "Error in query generation")
        }
      })

      eventSourceRef.current.addEventListener("queries", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          console.log("[Client] Received final queries:", data);
          let generated: string[] = [];
          
          // Handle both string array and stringified array
          if (data.queries && Array.isArray(data.queries)) {
            generated = data.queries.map((q: any) => {
              // If the query is a stringified array, parse it
              if (typeof q === 'string' && q.startsWith('[') && q.endsWith(']')) {
                try {
                  const parsed = JSON.parse(q);
                  return Array.isArray(parsed) ? parsed : [q];
                } catch {
                  return [q];
                }
              }
              return q;
            }).flat();
          }
          
          console.log("[Client] Parsed queries:", generated);
          setQueries(generated);
          if (generated.length === 0) {
            addProgressItem('warning', 'No queries were generated');
          }
        } catch (err) {
          console.warn("[Client] Failed to parse queries event data:", err);
          addProgressItem('error', "Failed to parse generated queries");
          setQueries([]);
        }
      });

      eventSourceRef.current.addEventListener("done", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          console.log("[Client] Query SSE done:", data)
          addProgressItem('success', data.message)
        } catch (err) {
          console.warn("[Client] Failed to parse done event data:", err)
          addProgressItem('success', "Query generation finished")
        }
        closeStream()
      })

      eventSourceRef.current.onerror = err => {
        console.error("[Client] EventSource error in query generation:", err)
        addProgressItem('error', "Query generation connection error or closed")
        closeStream()
      }

    } catch (error: any) {
      console.error('Error generating queries (SSE):', error)
      addProgressItem('error', `Failed to generate queries: ${error.message || 'Unknown error'}`)
      closeStream()
    }
  }

  // Launch SSE to the /api/search/scrape-stream route
  async function handleRunScrape() {
    if (queries.length === 0) {
      alert("No queries to run!")
      return
    }
    console.log("[Client] Starting scrape with queries:", queries)
    setIsScraping(true)
    setProgress([])

    try {
      eventSourceRef.current = new EventSource("/api/search/scrape-stream")

      eventSourceRef.current.onopen = () => {
        console.log("[Client] Scrape SSE open")
        addProgressItem('info', 'Connected to scrape SSE')
      }

      // Send POST request after connection is established
      const response = await fetch("/api/search/scrape-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries })
      })
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to start scraping: ${error}`)
      }

      eventSourceRef.current.addEventListener("connect", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          console.log("[Client] Connected for scraping:", data)
          addProgressItem('info', data.message)
        } catch (err) {
          console.warn("[Client] Failed to parse connect event data:", err)
          addProgressItem('info', "Connected to scraping service")
        }
      })

      eventSourceRef.current.onmessage = (event: MessageEvent) => {
        try {
          console.log("[Client] Received default message:", event.data)
          const data = JSON.parse(event.data)
          addProgressItem('info', data.message || `Message: ${event.data}`)
        } catch (err) {
          console.warn("[Client] Failed to parse message event data:", err)
          addProgressItem('info', `Message: ${event.data}`)
        }
      }

      eventSourceRef.current.addEventListener("searchStart", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          console.log("[Client] Search started:", data)
          addProgressItem('info', `Starting search for: ${data.query}`, data)
        } catch (err) {
          console.warn("[Client] Failed to parse searchStart event data:", err)
          addProgressItem('info', "Starting search")
        }
      })

      // Additional event to show search results
      eventSourceRef.current.addEventListener("searchResult", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          console.log("[Client] Search result detail:", data)
          addProgressItem('info', `Found result: ${data.title || data.url}`, data)
        } catch (err) {
          console.warn("[Client] Failed to parse searchResult event data:", err)
          addProgressItem('info', "Found search result")
        }
      })

      eventSourceRef.current.addEventListener("searchComplete", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          console.log("[Client] Search completed:", data)
          addProgressItem('success', `Found ${data.count} results for "${data.query}"`, data)
        } catch (err) {
          console.warn("[Client] Failed to parse searchComplete event data:", err)
          addProgressItem('success', "Search completed")
        }
      })

      eventSourceRef.current.addEventListener("scrapeStart", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          console.log("[Client] Scrape started:", data)
          addProgressItem('info', `Scraping ${data.url} (${data.index} of ${data.total})`, data)
        } catch (err) {
          console.warn("[Client] Failed to parse scrapeStart event data:", err)
          addProgressItem('info', "Started scraping website")
        }
      })

      eventSourceRef.current.addEventListener("scrapeComplete", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          console.log("[Client] Scrape completed:", data)
          addProgressItem(
            data.success ? 'success' : 'warning',
            `Completed scraping ${data.url}${data.success ? '' : ` (${data.message})`}`,
            data
          )
        } catch (err) {
          console.warn("[Client] Failed to parse scrapeComplete event data:", err)
          addProgressItem('success', "Completed scraping website")
        }
      })

      eventSourceRef.current.addEventListener("scrapeError", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          console.log("[Client] Scrape error:", data)
          addProgressItem('error', `Error scraping ${data.url}: ${data.error || data.reason}`, data)
        } catch (err) {
          console.warn("[Client] Failed to parse scrapeError event data:", err)
          addProgressItem('error', "Error while scraping website")
        }
      })

      eventSourceRef.current.addEventListener("rateLimit", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          console.log("[Client] Rate limited:", data)
          addProgressItem('warning', `Rate limited: ${data.message}`, data)
        } catch (err) {
          console.warn("[Client] Failed to parse rateLimit event data:", err)
          addProgressItem('warning', "Rate limit reached")
        }
      })

      eventSourceRef.current.addEventListener("businessProfile", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          console.log("[Client] Business profile found:", data)
          addProgressItem(
            'success',
            `Found business: ${data.business_name || "(no name)"} - ${data.website_url}`,
            data
          )
        } catch (err) {
          console.warn("[Client] Failed to parse businessProfile event data:", err)
          addProgressItem('success', "Found business profile")
        }
      })

      eventSourceRef.current.addEventListener("done", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          console.log("[Client] All done scraping:", data)
          addProgressItem('success', data.message || "All done")
        } catch (err) {
          console.warn("[Client] Failed to parse done event data:", err)
          addProgressItem('success', "All done")
        }
        closeStream()
      })

      eventSourceRef.current.onerror = err => {
        console.error("[Client] Scrape SSE error:", err)
        addProgressItem('error', "Scrape connection error or closed")
        closeStream()
      }
    } catch (err: any) {
      console.error("[Client] Error in handleRunScrape:", err)
      addProgressItem('error', err.message || 'Failed to start scraping')
      closeStream()
    }
  }

  function addProgressItem(type: ProgressItem['type'], message: string, details?: any) {
    setProgress(prev => [...prev, { type, message, details, timestamp: new Date() }])
  }

  function closeStream() {
    console.log("[Client] Closing EventSource connection")
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsPending(false)
    setIsScraping(false)
  }

  useEffect(() => {
    return () => {
      // Cleanup if the user leaves the page
      closeStream()
    }
  }, [])

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Lead Finder Dashboard</h1>

      {/* Input prompt */}
      <div className="space-x-2">
        <input
          className="border p-1 rounded"
          type="text"
          placeholder='E.g. "dentists in Texas"'
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
        />
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isPending ? "Generating..." : "Generate Queries"}
        </button>
      </div>

      {/* Queries List */}
      {queries.length > 0 && (
        <div className="mt-4">
          <h2 className="font-semibold mb-2">Proposed Search Queries:</h2>
          <ul className="space-y-1">
            {queries.map((q) => (
              <li key={q} className="flex items-center space-x-2">
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Run Scrape Button */}
      {queries.length > 0 && (
        <button
          onClick={handleRunScrape}
          disabled={isScraping}
          className="bg-green-500 text-white px-3 py-1 mt-2 rounded hover:bg-green-600 disabled:opacity-50"
        >
          {isScraping ? "Scraping in progress..." : "Run Scrape"}
        </button>
      )}

      {/* Real-time progress */}
      {progress.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <h3 className="font-semibold mb-2">Real-time Progress:</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {progress.map((item, i) => (
              <div
                key={i}
                className={`p-2 rounded text-sm ${
                  item.type === 'error'
                    ? 'bg-red-100 text-red-800'
                    : item.type === 'warning'
                    ? 'bg-yellow-100 text-yellow-800'
                    : item.type === 'success'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span>{item.message}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {item.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                {item.details && (
                  <pre className="mt-1 text-xs overflow-x-auto">
                    {JSON.stringify(item.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 