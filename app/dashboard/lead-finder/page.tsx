"use client"

import { useState, useRef, useEffect } from "react"

interface ProgressItem {
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  timestamp: Date;
}

/**
 * This page allows the user to:
 * 1. Enter an overall prompt to generate search queries (SSE usage).
 * 2. Edit/approve queries.
 * 3. Click "Run Scrape" to do SSE streaming from the server (scrape).
 * 4. Watch new business profiles or progress appear live.
 *
 * We'll rewrite the SSE event listeners to show EXACTLY what the backend sends.
 */
export default function LeadFinderPage() {
  const [promptInput, setPromptInput] = useState("")
  const [queries, setQueries] = useState<string[]>([])
  const [isPending, setIsPending] = useState(false)
  const [isScraping, setIsScraping] = useState(false)
  const [progress, setProgress] = useState<ProgressItem[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)

  /**
   * Utility to add a new progress item
   */
  function addProgressItem(type: ProgressItem['type'], message: string, details?: any) {
    setProgress(prev => [
      ...prev,
      {
        type,
        message,
        details,
        timestamp: new Date()
      }
    ])
  }

  /**
   * Closes any open SSE connection
   */
  function closeStream() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsPending(false)
    setIsScraping(false)
  }

  /**
   * SSE-based approach to generate queries. Streams progress from /api/search/generate-queries-stream
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
      // Create new SSE connection to GET /api/search/generate-queries-stream
      eventSourceRef.current = new EventSource("/api/search/generate-queries-stream")

      eventSourceRef.current.onopen = async () => {
        // Once open, we do a POST to actually start query generation
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

      // We can unify the onmessage logic:
      eventSourceRef.current.onmessage = (e: MessageEvent) => {
        // This is the default event
        try {
          addProgressItem('info', `[message] ${e.data}`)
        } catch (err) {
          addProgressItem('error', 'Failed to parse "message" event data', err)
        }
      }

      // For any custom SSE event
      const eventNames = ["connect","start","thinking","complete","error","queries","done"]
      for (const evtName of eventNames) {
        eventSourceRef.current.addEventListener(evtName, (e: MessageEvent) => {
          try {
            // Show exactly what we got
            addProgressItem('info', `[${evtName}] ${e.data}`)
            // If it's "queries", let's also parse them
            if (evtName === "queries") {
              const parsed = JSON.parse(e.data)
              if (parsed && Array.isArray(parsed.queries)) {
                setQueries(parsed.queries)
              }
            }
          } catch (err) {
            addProgressItem('error', `Failed to parse ${evtName} event data`, err)
          }
        })
      }

      // If there's an SSE error
      eventSourceRef.current.onerror = err => {
        addProgressItem('error', "Query generation connection error or closed", err)
        closeStream()
      }

    } catch (error: any) {
      addProgressItem('error', `Failed to generate queries: ${error.message || 'Unknown error'}`)
      closeStream()
    }
  }

  /**
   * Launch SSE to /api/search/scrape-stream
   */
  async function handleRunScrape() {
    if (queries.length === 0) {
      alert("No queries to run!")
      return
    }
    setIsScraping(true)
    setProgress([])

    try {
      eventSourceRef.current = new EventSource("/api/search/scrape-stream")

      eventSourceRef.current.onopen = async () => {
        const response = await fetch("/api/search/scrape-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queries })
        })
        if (!response.ok) {
          const error = await response.text()
          throw new Error(`Failed to start scraping: ${error}`)
        }
      }

      // Default event
      eventSourceRef.current.onmessage = (e: MessageEvent) => {
        try {
          addProgressItem('info', `[message] ${e.data}`)
        } catch (err) {
          addProgressItem('error', 'Failed to parse default message event data', err)
        }
      }

      // Listen for known events from the scraping SSE
      const eventNames = [
        "connect",
        "searchStart",
        "searchResult",
        "searchComplete",
        "scrapeStart",
        "scrapeComplete",
        "scrapeError",
        "rateLimit",
        "businessProfile",
        "done",
        "error"
      ]
      for (const evtName of eventNames) {
        eventSourceRef.current.addEventListener(evtName, (e: MessageEvent) => {
          try {
            addProgressItem('info', `[${evtName}] ${e.data}`)
          } catch (err) {
            addProgressItem('error', `Failed to parse ${evtName} event data`, err)
          }
        })
      }

      // If there's an SSE error
      eventSourceRef.current.onerror = err => {
        addProgressItem('error', "Scrape SSE connection error or closed", err)
        closeStream()
      }
    } catch (err: any) {
      addProgressItem('error', err.message || 'Failed to start scraping')
      closeStream()
    }
  }

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
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
                  <span className="whitespace-pre-wrap">{item.message}</span>
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