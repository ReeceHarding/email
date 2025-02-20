"use client"

import React, { useState, useRef, useEffect } from "react"
import { generateSearchQueriesAction } from "@/actions/generate-search-queries"
import { startTransition, useTransition } from "react"

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
  const [isPending, startTransition] = useTransition()
  const [isScraping, setIsScraping] = useState(false)
  const [messages, setMessages] = useState<string[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)

  async function handleGenerate() {
    setQueries([])
    setMessages([])
    startTransition(() => {
      generateSearchQueriesAction(promptInput).then(newQueries => {
        setQueries(newQueries)
      })
    })
  }

  function handleRemoveQuery(q: string) {
    setQueries(prev => prev.filter(item => item !== q))
  }

  // Launch SSE to the /api/search/scrape-stream route
  async function handleRunScrape() {
    if (queries.length === 0) {
      alert("No queries to run!")
      return
    }
    setIsScraping(true)
    setMessages([])
    eventSourceRef.current = new EventSource("/api/search/scrape-stream", {
      withCredentials: false
    })

    // We POST the queries via fetch, but also we keep the SSE open to read data.
    // Because we can't pass JSON directly via SSE, we do a fetch() to the same route but with POST, 
    // but that won't create an SSE. We can do a single route but we need to do a GET with query params 
    // if we want SSE easily. Instead, let's do a small approach with an ephemeral route or 
    // we do a fetch first, then start SSE. 
    // For simplicity, let's do queries in the search params:
    // But that might exceed the URL length if queries are big. Let's do a simpler approach:
    // We'll do a small hack: We open the EventSource, then do a fetch on the same route with the queries in the body.
    // The route won't read from SSE, but from the start method. A real approach might unify them. 
    // We'll do a quick approach: we store queries in local state on server side or a DB, or pass it in a query param. 
    // For a production approach, you might store them in Redis or encode them in base64. 
    // We'll do a simplistic approach here: eventSource won't start receiving until server calls "start" on itself. 
    // This is a quick demonstration. 

    // We'll do a side fetch to the same route
    fetch("/api/search/scrape-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queries })
    }).catch(err => {
      console.error("Failed to start scraping:", err)
    })

    // Handle SSE messages:
    eventSourceRef.current.onmessage = (event) => {
      // default event
      addMessage(`Message: ${event.data}`)
    }
    eventSourceRef.current.addEventListener("queryStart", e => {
      const data = JSON.parse(e.data)
      addMessage(`Starting Query: ${data.query}`)
    })
    eventSourceRef.current.addEventListener("queryComplete", e => {
      const data = JSON.parse(e.data)
      addMessage(`Completed Query: ${data.query}`)
    })
    eventSourceRef.current.addEventListener("queryError", e => {
      const data = JSON.parse(e.data)
      addMessage(`Query error: ${data.query} => ${data.message}`)
    })
    eventSourceRef.current.addEventListener("businessProfile", e => {
      const data = JSON.parse(e.data)
      addMessage(`New BusinessProfile => ${data.business_name || "(no name)"} - ${data.website_url}`)
    })
    eventSourceRef.current.addEventListener("done", e => {
      const data = JSON.parse(e.data)
      addMessage(`All done: ${data.message}`)
      closeStream()
    })
    eventSourceRef.current.onerror = err => {
      addMessage(`EventSource error or closed.`)
      closeStream()
    }
  }

  function addMessage(msg: string) {
    setMessages(prev => [...prev, msg])
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
          className="border p-1"
          type="text"
          placeholder='E.g. "dentists in Texas"'
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
        />
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="bg-blue-500 text-white px-3 py-1"
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
                  className="bg-red-300 text-xs px-2"
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
          className="bg-green-500 text-white px-3 py-1 mt-2"
        >
          {isScraping ? "Scraping in progress..." : "Run Scrape"}
        </button>
      )}

      {/* Real-time messages */}
      {messages.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <h3 className="font-semibold mb-2">Real-time Scrape Updates:</h3>
          <div className="space-y-1">
            {messages.map((m, i) => (
              <div key={i} className="text-sm">
                {m}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 