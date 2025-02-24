"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { ScrapingProvider, useScrapingContext } from "./context/scraping-context"
import ScrapingProgress from "./_components/scraping-progress"

interface BusinessProfile {
  name?: string;
  website?: string;
  email?: string;
  description?: string;
  phone?: string;
  socialLinks?: Record<string, string>;
}

function LeadFinderContent() {
  console.log("[LeadFinderContent] Render start...")

  const searchParams = useSearchParams()
  const { addMessage, eventSource, setEventSource } = useScrapingContext()

  const [promptInput, setPromptInput] = useState(searchParams.get("q") || "")
  const [queries, setQueries] = useState<string[]>([])
  const [isPending, setIsPending] = useState(false)
  const [isScraping, setIsScraping] = useState(false)
  const [discoveredResults, setDiscoveredResults] = useState<BusinessProfile[]>([])

  // We use a ref to track if component is unmounted
  const mountedRef = useRef(true)

  useEffect(() => {
    console.log("[LeadFinderContent] Mounted with initial state", {
      promptInput,
      queries,
      isPending,
      isScraping,
      discoveredResults
    })
    mountedRef.current = true

    return () => {
      console.log("[LeadFinderContent] Unmounting. Final state was:", {
        promptInput,
        queries,
        isPending,
        isScraping,
        discoveredResults
      })
      mountedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debug effect each time the discoveredResults changes
  useEffect(() => {
    console.log("[LeadFinderContent] discoveredResults updated:", discoveredResults)
  }, [discoveredResults])

  // Debug effects to track state changes
  useEffect(() => {
    console.log("[LeadFinderContent] isScraping changed:", isScraping)
  }, [isScraping])

  useEffect(() => {
    console.log("[LeadFinderContent] discoveredResults changed:", discoveredResults)
  }, [discoveredResults])

  // Helper to ensure we only set state if mounted
  const safeSetState = useCallback(<T,>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    value: T | ((prev: T) => T),
    description?: string
  ) => {
    console.log(`[LeadFinderContent] safeSetState called. State: ${description || "unknown"}`, {
      value,
      isMounted: mountedRef.current
    })
    
    if (mountedRef.current) {
      if (typeof value === 'function') {
        setter((prev: T) => {
          const next = (value as ((prev: T) => T))(prev)
          console.log(`[LeadFinderContent] State update complete: ${description}`, {
            prev,
            next
          })
          return next
        })
      } else {
        setter(value)
        console.log(`[LeadFinderContent] State update complete: ${description}`, {
          value
        })
      }
    } else {
      console.log("[LeadFinderContent] Skip setState because unmounted.")
    }
  }, [mountedRef])

  // Add a cleanup function to handle all state resets
  function resetState() {
    console.log("[LeadFinderContent] Resetting state")
    safeSetState<boolean>(setIsScraping, false, "isScraping=false in resetState")
    safeSetState<boolean>(setIsPending, false, "isPending=false in resetState")
  }

  function closeStream() {
    console.log("[LeadFinderContent] closeStream called")
    if (eventSource) {
      console.log("[LeadFinderContent] Closing SSE eventSource")
      eventSource.close()
      setEventSource(null)
    }
    resetState()
  }

  // If we come here with a query param, let's auto-generate
  useEffect(() => {
    const existingQuery = searchParams.get("q")
    if (existingQuery && !isPending && !isScraping && queries.length === 0) {
      console.log("[LeadFinderContent] Found 'q' in URL. Auto-generating query:", existingQuery)
      handleGenerate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Called when user clicks to generate
  async function handleGenerate() {
    console.log("[LeadFinderContent] handleGenerate called with promptInput:", promptInput)
    if (!promptInput.trim()) {
      addMessage("Please enter a prompt first", "error")
      return
    }

    safeSetState<boolean>(setIsPending, true, "isPending=true in handleGenerate")
    safeSetState<string[]>(setQueries, [], "clear queries before generation")
    safeSetState<BusinessProfile[]>(setDiscoveredResults, [], "clear discoveredResults before generation")

    addMessage(`Generating query for prompt: "${promptInput}"`, "info")

    // For demo, we generate one query
    const testQuery = `${promptInput} near me`
    setTimeout(() => {
      console.log("[LeadFinderContent] Setting test query after 500ms to:", testQuery)
      if (!mountedRef.current) return

      safeSetState<string[]>(setQueries, [testQuery], "set query array with single test query")
      addMessage("Generated test query", "info")
      safeSetState<boolean>(setIsPending, false, "isPending=false after generate done")
    }, 500)
  }

  // Called when user clicks "Run Test Scrape"
  async function handleRunScrape() {
    console.log("[LeadFinderContent] handleRunScrape called with queries:", queries)
    if (!queries.length) {
      addMessage("No query to run! Generate query first.", "error")
      return
    }

    safeSetState<boolean>(setIsScraping, true, "isScraping=true in handleRunScrape")
    safeSetState<BusinessProfile[]>(setDiscoveredResults, [], "clear discoveredResults for new scrape")

    // We'll open SSE GET: /api/search/scrape-stream
    try {
      addMessage("Opening SSE GET connection to /api/search/scrape-stream", "info")
      const newEventSource = new EventSource("/api/search/scrape-stream")
      console.log("[LeadFinderContent] Created new EventSource for GET SSE")

      setEventSource(newEventSource)

      newEventSource.onopen = async () => {
        console.log("[LeadFinderContent] SSE GET stream onopen -> sending POST with queries", queries)
        addMessage("Connected to SSE GET stream. Now sending POST with query...", "info")

        try {
          const response = await fetch("/api/search/scrape-stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ queries: [queries[0]] }) // Only 1 query
          })
          if (!response.ok) {
            const errorText = await response.text()
            throw new Error("Failed to start scraping: " + errorText)
          }
          addMessage("POST request to start scraping returned OK", "info")
        } catch (err: any) {
          console.error("[LeadFinderContent] Error sending POST to /api/search/scrape-stream:", err)
          addMessage(`Error sending POST request: ${err.message}`, "error")
        }
      }

      newEventSource.onerror = (err) => {
        console.error("[LeadFinderContent] SSE GET stream error:", err)
        addMessage("SSE connection error or closed", "error")
        resetState()
        closeStream()
      }

      // Handle events from SSE
      const knownEvents = [
        "searchStart",
        "searchResult",
        "searchComplete",
        "scrapeStart",
        "scrapeComplete",
        "businessProfile",
        "dbSuccess",
        "dbError",
        "error",
        "done",
        "log",
        "warn"
      ]

      knownEvents.forEach(evt => {
        newEventSource.addEventListener(evt, (e: MessageEvent) => {
          onSseEvent(e, evt)
        })
      })

    } catch (err: any) {
      console.error("[LeadFinderContent] handleRunScrape error:", err)
      addMessage(`Failed to run scrape: ${err.message}`, "error")
      closeStream()
    }
  }

  function onSseEvent(event: MessageEvent, eventName: string) {
    if (!event?.data) {
      console.log(`[LeadFinderContent] SSE event ${eventName} has no data`)
      return
    }
    try {
      const parsed = JSON.parse(event.data)
      console.log(`[LeadFinderContent] SSE event ${eventName} =>`, parsed)

      switch (eventName) {
        case "log":
        case "warn":
          // these are log messages
          addMessage(parsed.message, eventName === "warn" ? "error" : "info")
          break

        case "error":
          addMessage(parsed.message || "Server error event", "error")
          break

        case "searchStart":
          addMessage(`🔍 Starting search for: ${parsed.query}`, "search")
          break

        case "searchResult":
          addMessage(`📍 Found: ${parsed.title}`, "search")
          break

        case "searchComplete":
          addMessage(`✅ Search complete: Found ${parsed.count} results for "${parsed.query}"`, "search")
          break

        case "scrapeStart":
          addMessage(`🌐 Scraping website: ${parsed.url}`, "scrape")
          break

        case "scrapeComplete":
          addMessage(`✅ Finished scraping: ${parsed.url}`, "scrape")
          break

        case "businessProfile":
          console.log("[LeadFinderContent] businessProfile event data:", parsed)
          
          // Create business profile object first
          const newBusiness: BusinessProfile = {
            name: parsed.name || "Unknown Business",
            website: parsed.website,
            email: parsed.email,
            phone: parsed.phone,
            socialLinks: parsed.socialLinks
          }

          console.log("[LeadFinderContent] Created newBusiness object:", newBusiness)

          // Only add message and update state if we have some meaningful data
          if (newBusiness.website || newBusiness.email || newBusiness.phone) {
            addMessage(
              `🏢 Found business: ${newBusiness.name} ${newBusiness.phone ? `(${newBusiness.phone})` : ""} ${newBusiness.email ? ` - ${newBusiness.email}` : ""}`,
              "business"
            )

            // Update discovered results with proper duplicate checking
            safeSetState<BusinessProfile[]>(setDiscoveredResults, prev => {
              console.log("[LeadFinderContent] Current discoveredResults:", prev)
              
              // Check for duplicates using any available unique identifier
              const exists = prev.some(b => {
                const websiteMatch = b.website && newBusiness.website && 
                  b.website.toLowerCase() === newBusiness.website.toLowerCase();
                const emailMatch = b.email && newBusiness.email && 
                  b.email.toLowerCase() === newBusiness.email.toLowerCase();
                const phoneMatch = b.phone && newBusiness.phone && 
                  b.phone.replace(/\D/g, '') === newBusiness.phone.replace(/\D/g, '');
                
                return websiteMatch || emailMatch || phoneMatch;
              });
              
              if (!exists) {
                console.log("[LeadFinderContent] Adding new business to discoveredResults")
                const newResults = [...prev, newBusiness]
                console.log("[LeadFinderContent] New discoveredResults:", newResults)
                return newResults
              } else {
                console.log("[LeadFinderContent] Business already exists. Not adding.")
                return prev
              }
            }, "businessProfile event => discoveredResults")
          } else {
            console.log("[LeadFinderContent] Skipping business profile - insufficient data")
          }
          break

        case "dbSuccess":
          addMessage(`🗄 Database success: ${parsed.message}`, "info")
          break

        case "dbError":
          addMessage(`DB Error: ${parsed.message}`, "error")
          break

        case "done":
          addMessage("✅ All queries processed. SSE done.", "info")
          console.log("[LeadFinderContent] SSE 'done' event => resetting state")
          resetState()
          setTimeout(() => {
            if (mountedRef.current) {
              console.log("[LeadFinderContent] done event => closeStream")
              closeStream()
            }
          }, 500)
          break
      }
    } catch (err) {
      console.error("[LeadFinderContent] Error parsing SSE data:", err)
      addMessage(`Error parsing SSE data: ${String(err)}`, "error")
    }
  }

  // Render our UI
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Lead Finder Dashboard (Test Mode)</h1>

      <div className="space-x-2">
        <input
          type="text"
          className="border p-1 rounded"
          placeholder='Try "dentists in Texas"'
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
        />
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isPending ? "Generating..." : "Generate Test Query"}
        </button>
      </div>

      {queries.length > 0 && (
        <div className="mt-4">
          <h2 className="font-semibold mb-2">Test Query:</h2>
          <div className="p-2 bg-gray-50 rounded">{queries[0]}</div>

          <button
            onClick={handleRunScrape}
            disabled={isScraping}
            className="bg-green-500 text-white px-3 py-1 mt-2 rounded hover:bg-green-600 disabled:opacity-50"
          >
            {isScraping ? "Scraping in progress..." : "Run Test Scrape"}
          </button>
        </div>
      )}

      <ScrapingProgress />

      <div className="mt-4">
        <h2 className="font-semibold mb-2">Discovered Business:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Business Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Website
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {discoveredResults.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-sm text-gray-500 text-center">
                    No businesses discovered yet
                  </td>
                </tr>
              ) : (
                discoveredResults.map((biz, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {biz.name || "Unknown"}
                    </td>
                    <td className="px-6 py-4 text-sm text-blue-600">
                      {biz.website ? (
                        <a href={biz.website} target="_blank" rel="noopener noreferrer">
                          {biz.website}
                        </a>
                      ) : "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {biz.phone || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {biz.email || "N/A"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function LeadFinderPage() {
  return (
    <ScrapingProvider>
      <LeadFinderContent />
    </ScrapingProvider>
  )
} 