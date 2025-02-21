"use client";

import { useEffect, useState, useRef } from "react";

interface MessageEvent {
  data: string;
}

interface ProgressData {
  type?: 'searchStart' | 'searchComplete' | 'searchResult' | 'scrapeError' | 'complete';
  query?: string;
  count?: number;
  url?: string;
  title?: string;
  description?: string;
  success?: boolean;
  message?: string;
  results?: Array<{ url: string; title: string }>;
}

export default function ScrapingProgress() {
  const [messages, setMessages] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const eventSource = new EventSource('/api/search/scrape-stream');
    eventSourceRef.current = eventSource;

    // Log every event for debugging
    eventSource.onmessage = (event: MessageEvent) => {
      console.log('[FRONTEND-DEBUG] Raw SSE message:', event);
    };

    // Handle searchStart
    eventSource.addEventListener('searchStart', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      setMessages(prev => [...prev, `Starting search for: ${data.query}`]);
    });

    // Handle each searchResult
    eventSource.addEventListener('searchResult', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      setMessages(prev => [...prev, `Found: ${data.title} (${data.url})`]);
    });

    // Handle searchComplete
    eventSource.addEventListener('searchComplete', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      setMessages(prev => [...prev, `Search completed with ${data.count} results`]);
    });

    // Handle complete
    eventSource.addEventListener('complete', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      setMessages(prev => [...prev, data.message]);
    });

    // Handle errors
    eventSource.addEventListener('error', (event: MessageEvent) => {
      console.error('[FRONTEND-DEBUG] SSE error:', event);
      if (event.data) {
        const data = JSON.parse(event.data);
        setMessages(prev => [...prev, `Error: ${data.message}`]);
      }
    });

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div className="mt-4 space-y-2">
      <h3 className="font-semibold">Real-time Progress:</h3>
      <div className="bg-gray-100 p-4 rounded-lg max-h-96 overflow-y-auto space-y-1">
        {messages.map((message, i) => (
          <div key={i} className="text-sm">
            <span className="text-gray-500 text-xs">
              {new Date().toLocaleTimeString()}
            </span>
            {' '}
            {message}
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-gray-500 text-sm italic">No progress yet...</div>
        )}
      </div>
    </div>
  );
} 