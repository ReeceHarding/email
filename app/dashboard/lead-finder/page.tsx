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
 * 1. Enter an overall prompt to generate search queries with LLM
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

  async function handleGenerate() {
    setQueries([])
    setProgress([])
    setIsPending(true)
    try {
      const newQueries = await generateSearchQueriesAction(promptInput, (progress) => {
        // Map query generation progress to our progress items
        switch (progress.type) {
          case 'start':
            addProgressItem('info', progress.message, progress.data)
            break
          case 'thinking':
            addProgressItem('info', progress.message, progress.data)
            break
          case 'complete':
            addProgressItem('success', progress.message, progress.data)
            break
          case 'error':
            addProgressItem('error', progress.message, progress.data)
            break
        }
      })
      setQueries(newQueries)
    } finally {
      setIsPending(false)
    }
  }

  function handleRemoveQuery(q: string) {
    setQueries(prev => prev.filter(item => item !== q))
  }

  function addProgressItem(type: ProgressItem['type'], message: string, details?: any) {
    setProgress(prev => [...prev, { type, message, details, timestamp: new Date() }])
  }

  // Launch SSE to the /api/search/scrape-stream route
  async function handleRunScrape() {
    if (queries.length === 0) {
      alert("No queries to run!")
      return
    }
    setIsScraping(true)
    setProgress([])
    eventSourceRef.current = new EventSource("/api/search/scrape-stream", {
      withCredentials: false
    })

    // We'll do a side fetch to the same route
    fetch("/api/search/scrape-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queries })
    }).catch(err => {
      console.error("Failed to start scraping:", err)
      addProgressItem('error', 'Failed to start scraping', err)
    })

    // Handle SSE messages:
    eventSourceRef.current.onmessage = (event) => {
      // default event
      addProgressItem('info', `Message: ${event.data}`)
    }

    eventSourceRef.current.addEventListener("searchStart", e => {
      const data = JSON.parse(e.data)
      addProgressItem('info', `Starting search for: ${data.query}`, data)
    })

    eventSourceRef.current.addEventListener("searchComplete", e => {
      const data = JSON.parse(e.data)
      addProgressItem('success', `Found ${data.count} results for "${data.query}"`, data)
    })

    eventSourceRef.current.addEventListener("scrapeStart", e => {
      const data = JSON.parse(e.data)
      addProgressItem('info', `Scraping ${data.url} (${data.index} of ${data.total})`, data)
    })

    eventSourceRef.current.addEventListener("scrapeComplete", e => {
      const data = JSON.parse(e.data)
      addProgressItem(
        data.success ? 'success' : 'warning',
        `Completed scraping ${data.url}${data.success ? '' : ` (${data.message})`}`,
        data
      )
    })

    eventSourceRef.current.addEventListener("scrapeError", e => {
      const data = JSON.parse(e.data)
      addProgressItem('error', `Error scraping ${data.url}: ${data.error || data.reason}`, data)
    })

    eventSourceRef.current.addEventListener("rateLimit", e => {
      const data = JSON.parse(e.data)
      addProgressItem('warning', `Rate limited: ${data.message}`, data)
    })

    eventSourceRef.current.addEventListener("businessProfile", e => {
      const data = JSON.parse(e.data)
      addProgressItem(
        'success',
        `Found business: ${data.business_name || "(no name)"} - ${data.website_url}`,
        data
      )
    })

    eventSourceRef.current.addEventListener("done", e => {
      const data = JSON.parse(e.data)
      addProgressItem('success', `All done: ${data.message}`, data)
      closeStream()
    })

    eventSourceRef.current.onerror = err => {
      addProgressItem('error', `EventSource error or closed.`, err)
      closeStream()
    }
  }

  function closeStream() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      setIsScraping(false)
    }
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
                <button
                  className="bg-red-300 text-xs px-2 rounded hover:bg-red-400"
                  onClick={() => handleRemoveQuery(q)}
                >
                  Remove
                </button>
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