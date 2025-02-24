"use client"

import { useState, useEffect } from "react"
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
  const searchParams = useSearchParams()
  const [promptInput, setPromptInput] = useState(searchParams.get("q") || "")
  const [queries, setQueries] = useState<string[]>([])
  const [isPending, setIsPending] = useState(false)
  const [isScraping, setIsScraping] = useState(false)
  const [discoveredResults, setDiscoveredResults] = useState<BusinessProfile[]>([])
  
  const { addMessage, eventSource, setEventSource } = useScrapingContext()

  useEffect(() => {
    const query = searchParams.get("q")
    if (query && !isPending && !isScraping && queries.length === 0) {
      handleGenerate()
    }
  }, [searchParams])

  useEffect(() => {
    // Cleanup SSE connection on unmount
    return () => {
      if (eventSource) {
        console.log("[LeadFinderPage] Cleaning up SSE connection")
        eventSource.close()
        setEventSource(null)
      }
    }
  }, [eventSource])

  function closeStream() {
    if (eventSource) {
      console.log("[LeadFinderPage] Closing SSE stream")
      eventSource.close()
      setEventSource(null)
    }
    setIsPending(false)
    setIsScraping(false)
  }

  async function handleGenerate() {
    if (!promptInput.trim()) {
      addMessage('Please enter a prompt first', 'error')
      return
    }

    setIsPending(true)
    setQueries([])
    setDiscoveredResults([])

    addMessage(`Generating query for prompt: "${promptInput}"`, 'info')

    // Just one query for testing
    const testQuery = `${promptInput} near me`
    setTimeout(() => {
      setQueries([testQuery])
      addMessage('Generated test query', 'info')
      setIsPending(false)
    }, 500)
  }

  async function handleRunScrape() {
    if (!queries.length) {
      addMessage('No query to run! Generate query first.', 'error')
      return
    }

    setIsScraping(true)
    setDiscoveredResults([])

    try {
      addMessage('Opening SSE GET connection to /api/search/scrape-stream', 'info')
      const newEventSource = new EventSource("/api/search/scrape-stream")
      setEventSource(newEventSource)

      newEventSource.onopen = async () => {
        addMessage('Connected to SSE GET stream. Now sending POST with query...', 'info')
        try {
          // Send only first query
          const response = await fetch("/api/search/scrape-stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ queries: [queries[0]], maxResults: 1 })
          })
          if (!response.ok) {
            const error = await response.text()
            throw new Error("Failed to start scraping: " + error)
          }
          addMessage('POST request to start scraping returned OK', 'info')
        } catch (err: any) {
          addMessage(`Error sending POST request: ${err.message}`, 'error')
        }
      }

      newEventSource.onerror = (err) => {
        console.error("[LeadFinderPage] SSE connection error or closed:", err)
        addMessage('SSE connection error or closed', 'error')
        closeStream()
      }

      // Handle different event types
      const handleEvent = (event: MessageEvent, eventName: string) => {
        if (!event?.data) return
        try {
          const data = JSON.parse(event.data)
          switch (eventName) {
            case "log":
            case "warn":
            case "error":
              // Handle server-side logs
              const logPrefix = eventName === 'error' ? '❌' : eventName === 'warn' ? '⚠️' : '📝'
              addMessage(`${logPrefix} ${data.message}`, eventName === 'log' ? 'info' : 'error')
              break
            case "searchStart":
              addMessage(`🔍 Starting search for: ${data.query}`, 'search')
              break
            case "searchResult":
              addMessage(`📍 Found: ${data.title}`, 'search')
              break
            case "searchComplete":
              addMessage(`✅ Search complete: Found ${data.count} results for "${data.query}"`, 'search')
              break
            case "scrapeStart":
              addMessage(`🌐 Scraping website: ${data.url}`, 'scrape')
              break
            case "scrapeComplete":
              addMessage(`✅ Finished scraping: ${data.url}`, 'scrape')
              break
            case "businessProfile":
              const businessMsg = `🏢 Found business: ${data.name || 'Unknown'}${data.phone ? ` (${data.phone})` : ''}${data.email ? ` - ${data.email}` : ''}`
              addMessage(businessMsg, 'business')
              setDiscoveredResults(prev => [...prev, data])
              break
            case "done":
              addMessage('✅ All queries processed. SSE done.', 'info')
              closeStream()
              break
          }
        } catch (err) {
          if (event.data) {
            addMessage(event.data, 'info')
          }
        }
      }

      // Map events to handlers
      const events = [
        'searchStart',
        'searchResult',
        'searchComplete',
        'scrapeStart',
        'scrapeComplete',
        'businessProfile',
        'error',
        'done',
        'log',
        'warn',
        'error'
      ]

      events.forEach(eventName => {
        newEventSource.addEventListener(eventName, (e) => handleEvent(e, eventName))
      })

    } catch (err: any) {
      addMessage(`Failed to run scrape: ${err.message}`, 'error')
      closeStream()
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Lead Finder Dashboard (Test Mode)</h1>

      <div className="space-x-2">
        <input
          className="border p-1 rounded"
          type="text"
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
          <div className="p-2 bg-gray-50 rounded">
            {queries[0]}
          </div>
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
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Business Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Website
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                discoveredResults.map((business, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {business.name || 'Unknown Business'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {business.website ? (
                        <a 
                          href={business.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          {new URL(business.website).hostname}
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {business.phone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {business.email || '-'}
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