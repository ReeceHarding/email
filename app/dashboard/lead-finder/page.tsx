"use client"

import { useState, useRef, useEffect } from "react"
import { useSearchParams } from "next/navigation"

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
 * 5. Display discovered results in a table, with search and sorting.
 */
export default function LeadFinderPage() {
  const searchParams = useSearchParams()
  const [promptInput, setPromptInput] = useState(searchParams.get("q") || "")
  const [queries, setQueries] = useState<string[]>([])
  const [isPending, setIsPending] = useState(false)
  const [isScraping, setIsScraping] = useState(false)
  const [progress, setProgress] = useState<ProgressItem[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)

  // For table data
  interface DiscoveredResult {
    url: string;
    title: string;
    description: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    address?: string;
  }

  const [discoveredResults, setDiscoveredResults] = useState<DiscoveredResult[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<"title" | "url">("title")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  // Auto-start search if query is provided
  useEffect(() => {
    const query = searchParams.get("q")
    if (query && !isPending && !isScraping && queries.length === 0) {
      handleGenerate()
    }
  }, [searchParams])

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
          // We won't parse the default 'message' event or do anything special
          // We'll log it to progress with a less-technical message
          addProgressItem('info', `General message: ${e.data}`)
        } catch (err) {
          addProgressItem('error', 'Failed to parse \'message\' event data', err)
        }
      }

      // For any custom SSE event
      const eventNames = ["connect","start","thinking","complete","error","queries","done"]
      for (const evtName of eventNames) {
        eventSourceRef.current.addEventListener(evtName, (e: MessageEvent) => {
          try {
            const payload = JSON.parse(e.data)

            if (evtName === "connect") {
              addProgressItem('info', `Connected to stream: ${payload.message}`)
              return
            }
            if (evtName === "start") {
              addProgressItem('info', `Starting query generation: ${payload.userPrompt}`)
              return
            }
            if (evtName === "thinking") {
              addProgressItem('info', payload.message)
              return
            }
            if (evtName === "complete") {
              addProgressItem('success', payload.message || "Queries generated")
              return
            }
            if (evtName === "error") {
              addProgressItem('error', `Query generation error: ${payload.message}`)
              return
            }
            if (evtName === "queries") {
              addProgressItem('info', 'Queries received from server')
              const parsed = payload
              if (parsed && Array.isArray(parsed.queries)) {
                setQueries(parsed.queries)
              }
              return
            }
            if (evtName === "done") {
              addProgressItem('success', 'All query generation events sent')
              closeStream()
              // Auto-start scraping when queries are generated
              handleRunScrape()
            }
          } catch (err) {
            addProgressItem('error', `Failed to parse ${evtName} event data`, err)
          }
        })
      }

      // If there's an SSE error
      eventSourceRef.current.onerror = err => {
        addProgressItem('error', 'Connection error or closed for query generation', err)
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
      addProgressItem('error', 'No queries to run! Please generate queries first.')
      return
    }
    setIsScraping(true)
    setProgress([])
    setDiscoveredResults([])

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
          // We won't parse the default 'message' event data in detail
          addProgressItem('info', `Scraping message: ${e.data}`)
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
            const data = JSON.parse(e.data)

            switch (evtName) {
              case "connect": {
                addProgressItem('info', `Scraping connection established: ${data.message || ""}`)
                break
              }
              case "searchStart": {
                addProgressItem('info', `Searching: ${data.query || "Unknown query"}`)
                break
              }
              case "searchResult": {
                // This is where we got partial website info
                addProgressItem('info', `Discovered website: ${data.title} (${data.url})`)
                // We can store them in discoveredResults, maybe fill placeholders
                const newRes: DiscoveredResult = {
                  url: data.url,
                  title: data.title,
                  description: data.description || "",
                  email: "",     // SSE doesn't provide these but we keep columns
                  phone: "",
                  linkedin: "",
                  address: "",
                }
                setDiscoveredResults((prev) => [...prev, newRes])
                break
              }
              case "searchComplete": {
                addProgressItem('success', `Search complete: Found ${data.count} results for "${data.query}"`)
                break
              }
              case "scrapeStart": {
                addProgressItem('info', `Scraping started: ${data.url}`)
                break
              }
              case "scrapeComplete": {
                addProgressItem('success', `Scraping completed: ${data.url}`)
                // If there's deeper data, we might store them, for now we do nothing
                break
              }
              case "scrapeError": {
                addProgressItem('error', `Scrape error: ${data.message}`)
                break
              }
              case "rateLimit": {
                addProgressItem('warning', `Rate limit notice: ${data.message}`)
                break
              }
              case "businessProfile": {
                addProgressItem('info', `Business profile found: ${data.business_name || data.website_url}`)
                // Optionally update discoveredResults if we want more data
                break
              }
              case "error": {
                addProgressItem('error', `Scrape SSE error: ${data.message}`)
                closeStream()
                break
              }
              case "done": {
                addProgressItem('success', 'Scraping done for all queries')
                closeStream()
                break
              }
            }
          } catch (err) {
            addProgressItem('error', `Failed to parse ${evtName} event data`, err)
          }
        })
      }

      // If there's an SSE error
      eventSourceRef.current.onerror = err => {
        addProgressItem('error', 'Scrape SSE connection error or closed', err)
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

  // Filter & sort discovered results
  const filteredResults = discoveredResults
    .filter((item) => {
      const lower = searchTerm.toLowerCase()
      return (
        item.title.toLowerCase().includes(lower) ||
        item.url.toLowerCase().includes(lower) ||
        item.description.toLowerCase().includes(lower)
      )
    })
    .sort((a, b) => {
      // sort by either 'title' or 'url'
      const valA = a[sortField].toLowerCase()
      const valB = b[sortField].toLowerCase()
      if (valA < valB) return sortOrder === "asc" ? -1 : 1
      if (valA > valB) return sortOrder === "asc" ? 1 : -1
      return 0
    })

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Lead Finder Dashboard</h1>

      {/* Input prompt */}
      <div className="space-x-2">
        <input
          className="border p-1 rounded"
          type="text"
          placeholder='E.g. "chiropractors in Texas"'
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
          <div className="space-y-2 max-h-64 overflow-y-auto">
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

      {/* Discovered Results Table */}
      {discoveredResults.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-4">Discovered Websites</h3>
          {/* Search & Sorting */}
          <div className="flex items-center space-x-4 mb-4">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border p-1 rounded"
            />
            <label className="text-sm">
              Sort By:{" "}
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as "title" | "url")}
                className="border rounded p-1 ml-1"
              >
                <option value="title">Title</option>
                <option value="url">URL</option>
              </select>
            </label>
            <label className="text-sm">
              Order:{" "}
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                className="border rounded p-1 ml-1"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300 text-sm">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-2 border">Title</th>
                  <th className="p-2 border">URL</th>
                  <th className="p-2 border">Description</th>
                  <th className="p-2 border">Email</th>
                  <th className="p-2 border">Phone</th>
                  <th className="p-2 border">LinkedIn</th>
                  <th className="p-2 border">Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((item, i) => (
                  <tr key={`${item.url}-${i}`} className="border-b">
                    <td className="p-2 border">{item.title}</td>
                    <td className="p-2 border">
                      <a
                        href={item.url}
                        className="text-blue-600 underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.url}
                      </a>
                    </td>
                    <td className="p-2 border">{item.description}</td>
                    <td className="p-2 border">{item.email || ""}</td>
                    <td className="p-2 border">{item.phone || ""}</td>
                    <td className="p-2 border">{item.linkedin || ""}</td>
                    <td className="p-2 border">{item.address || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
} 