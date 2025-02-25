"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { ScrapingProvider, useScrapingContext } from "./context/scraping-context"
import ScrapingProgress from "./_components/scraping-progress"
import { SearchX, Search, Loader2, Building2, RefreshCw, Globe, X } from "lucide-react"

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
  const [searchResults, setSearchResults] = useState<Array<{title: string, url: string, description?: string}>>([])
  const [currentStep, setCurrentStep] = useState<'idle' | 'searching' | 'scraping' | 'completed'>('idle')

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
    safeSetState<'idle' | 'searching' | 'scraping' | 'completed'>(setCurrentStep, 'idle', "currentStep=idle in resetState")
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
    safeSetState<Array<{title: string, url: string, description?: string}>>(setSearchResults, [], "clear searchResults before generation")

    addMessage(`Generating query for prompt: "${promptInput}"`, "info")

    // For demo, we generate one query
    const testQuery = `${promptInput}`
    setTimeout(() => {
      console.log("[LeadFinderContent] Setting test query after 500ms to:", testQuery)
      if (!mountedRef.current) return

      safeSetState<string[]>(setQueries, [testQuery], "set query array with single test query")
      addMessage("Search query prepared", "info")
      safeSetState<boolean>(setIsPending, false, "isPending=false after generate done")
    }, 500)
  }

  // Called when user clicks "Run Search"
  async function handleRunScrape() {
    console.log("[LeadFinderContent] handleRunScrape called with queries:", queries)
    if (!queries.length) {
      addMessage("No query to run! Generate query first.", "error")
      return
    }

    safeSetState<boolean>(setIsScraping, true, "isScraping=true in handleRunScrape")
    safeSetState<BusinessProfile[]>(setDiscoveredResults, [], "clear discoveredResults for new scrape")
    safeSetState<Array<{title: string, url: string, description?: string}>>(setSearchResults, [], "clear searchResults for new search")
    safeSetState<'idle' | 'searching' | 'scraping' | 'completed'>(setCurrentStep, 'searching', "currentStep=searching in handleRunScrape")

    // We'll open SSE GET: /api/search/scrape-stream
    try {
      addMessage("Starting search with Brave Search API...", "info")
      const newEventSource = new EventSource("/api/search/scrape-stream")
      console.log("[LeadFinderContent] Created new EventSource for GET SSE")

      setEventSource(newEventSource)

      newEventSource.onopen = async () => {
        console.log("[LeadFinderContent] SSE GET stream onopen -> sending POST with queries", queries)
        addMessage("Connected to search stream. Starting search...", "info")

        try {
          const response = await fetch("/api/search/scrape-stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ queries: [queries[0]] }) // Only 1 query
          })
          if (!response.ok) {
            const errorText = await response.text()
            throw new Error("Failed to start search: " + errorText)
          }
          addMessage("Search started successfully", "info")
        } catch (err: any) {
          console.error("[LeadFinderContent] Error sending POST to /api/search/scrape-stream:", err)
          addMessage(`Error starting search: ${err.message}`, "error")
        }
      }

      newEventSource.onerror = (err) => {
        console.error("[LeadFinderContent] SSE GET stream error:", err)
        addMessage("Connection error or closed", "error")
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
      addMessage(`Failed to run search: ${err.message}`, "error")
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
          safeSetState<'idle' | 'searching' | 'scraping' | 'completed'>(setCurrentStep, 'searching', "currentStep=searching on searchStart")
          break

        case "searchResult":
          addMessage(`📍 Found: ${parsed.title}`, "search")
          // Add this result to the searchResults array
          safeSetState<Array<{title: string, url: string, description?: string}>>(
            setSearchResults, 
            prev => [...prev, {
              title: parsed.title,
              url: parsed.url,
              description: parsed.description
            }],
            "adding searchResult"
          )
          break

        case "searchComplete":
          addMessage(`✅ Search complete: Found ${parsed.count} results for "${parsed.query}"`, "search")
          break

        case "scrapeStart":
          addMessage(`🌐 Analyzing website: ${parsed.url}`, "scrape")
          safeSetState<'idle' | 'searching' | 'scraping' | 'completed'>(setCurrentStep, 'scraping', "currentStep=scraping on scrapeStart")
          break

        case "scrapeComplete":
          addMessage(`✅ Finished analyzing: ${parsed.url}`, "scrape")
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
          addMessage("✅ All processing complete!", "info")
          console.log("[LeadFinderContent] SSE 'done' event => resetting state")
          safeSetState<'idle' | 'searching' | 'scraping' | 'completed'>(setCurrentStep, 'completed', "currentStep=completed on done")
          
          setTimeout(() => {
            if (mountedRef.current) {
              safeSetState<boolean>(setIsScraping, false, "isScraping=false on done")
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
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="bg-white rounded-xl shadow-sm border p-8 mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Lead Finder</h1>
        <p className="text-gray-600 mb-8">
          Discover potential leads by searching for businesses and automatically extracting their contact information.
        </p>

        <div className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="query-input" className="block text-sm font-medium text-gray-700">
              What type of businesses are you looking for?
            </label>
            <div className="flex gap-2">
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="query-input"
                  type="text"
                  className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder='Try "dentists in Dallas" or "marketing agencies in New York"'
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  disabled={isPending || isScraping}
                />
                {promptInput && !isPending && !isScraping && (
                  <button 
                    onClick={() => setPromptInput('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <button
                onClick={handleGenerate}
                disabled={isPending || isScraping || !promptInput.trim()}
                className="px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparing...
                  </span>
                ) : (
                  "Prepare Search"
                )}
              </button>
            </div>
          </div>

          {queries.length > 0 && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <h2 className="font-medium text-blue-800 mb-1 flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search Query
              </h2>
              <p className="text-blue-600 text-sm">{queries[0]}</p>

              <div className="mt-4">
                <button
                  onClick={handleRunScrape}
                  disabled={isScraping}
                  className="px-4 py-2 rounded-md bg-green-600 text-white font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isScraping ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {currentStep === 'searching' ? 'Searching...' : 
                       currentStep === 'scraping' ? 'Analyzing sites...' : 
                       currentStep === 'completed' ? 'Completed' : 'Processing...'}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Run Search
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content area with progress and results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Progress log */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border h-full">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-800">Real-time Progress</h2>
            </div>
            <div className="p-4">
              <ScrapingProgress />
            </div>
          </div>
        </div>

        {/* Right columns: Search results and business profiles */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search results */}
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">Search Results</h2>
              <span className="text-sm text-gray-500">{searchResults.length} found</span>
            </div>
            <div className="p-4">
              {searchResults.length === 0 ? (
                <div className="text-center py-8">
                  {isScraping && currentStep === 'searching' ? (
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <Loader2 className="h-8 w-8 animate-spin mb-4 text-blue-500" />
                      <p>Searching with Brave Search API...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <SearchX className="h-8 w-8 mb-4" />
                      <p>No search results yet</p>
                      <p className="text-sm">Run a search to find businesses</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {searchResults.map((result, idx) => (
                    <div key={idx} className="p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                      <h3 className="font-medium text-blue-700">
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                          <Globe className="h-4 w-4" />
                          {result.title}
                        </a>
                      </h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{result.description || 'No description available'}</p>
                      <p className="text-xs text-gray-500 mt-1 truncate">{result.url}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Discovered businesses */}
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">Discovered Businesses</h2>
              <span className="text-sm text-gray-500">{discoveredResults.length} found</span>
            </div>
            <div className="p-4">
              {discoveredResults.length === 0 ? (
                <div className="text-center py-8">
                  {isScraping && currentStep === 'scraping' ? (
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <Loader2 className="h-8 w-8 animate-spin mb-4 text-green-500" />
                      <p>Analyzing websites to extract business information...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <Building2 className="h-8 w-8 mb-4" />
                      <p>No businesses discovered yet</p>
                      <p className="text-sm">Run a search to find businesses</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Business Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Website
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Contact Info
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {discoveredResults.map((biz, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {biz.name || "Unknown"}
                          </td>
                          <td className="px-4 py-3 text-sm text-blue-600">
                            {biz.website ? (
                              <a href={biz.website} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {biz.website.replace(/^https?:\/\/(www\.)?/, '')}
                              </a>
                            ) : "N/A"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="space-y-1">
                              {biz.email && (
                                <div className="text-gray-700">
                                  <span className="font-medium">Email:</span> {biz.email}
                                </div>
                              )}
                              {biz.phone && (
                                <div className="text-gray-700">
                                  <span className="font-medium">Phone:</span> {biz.phone}
                                </div>
                              )}
                              {(!biz.email && !biz.phone) && (
                                <div className="text-gray-500 italic">No contact info found</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
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