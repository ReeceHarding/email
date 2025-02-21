"use client";

import { useEffect, useState } from "react";

interface MessageEvent {
  data: string;
}

interface ProgressData {
  type?: 'searchStart' | 'searchComplete' | 'searchResult' | 'scrapeError';
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
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    console.log('[FRONTEND-DEBUG] Setting up SSE connection');
    
    const eventSource = new EventSource('/api/search/scrape-stream');

    eventSource.onopen = () => {
      console.log('[FRONTEND-DEBUG] SSE connection opened');
      setIsConnected(true);
      setMessages(prev => [...prev, 'Connected to scrape SSE']);
    };

    eventSource.addEventListener('searchStart', (event: MessageEvent) => {
      console.log('[FRONTEND-DEBUG] Search start event received:', {
        data: event.data,
        parsedData: tryParseJson(event.data)
      });
      
      try {
        const data = JSON.parse(event.data) as ProgressData;
        setMessages(prev => [...prev, formatProgressMessage(data)]);
      } catch (error) {
        console.error('[FRONTEND-DEBUG] Error parsing search start event:', {
          error,
          rawData: event.data
        });
      }
    });

    eventSource.addEventListener('searchResult', (event: MessageEvent) => {
      console.log('[FRONTEND-DEBUG] Search result event received:', {
        data: event.data,
        parsedData: tryParseJson(event.data)
      });
      
      try {
        const data = JSON.parse(event.data) as ProgressData;
        setMessages(prev => [...prev, formatProgressMessage(data)]);
      } catch (error) {
        console.error('[FRONTEND-DEBUG] Error parsing search result event:', {
          error,
          rawData: event.data
        });
      }
    });

    eventSource.addEventListener('searchComplete', (event: MessageEvent) => {
      console.log('[FRONTEND-DEBUG] Search complete event received:', {
        data: event.data,
        parsedData: tryParseJson(event.data)
      });
      
      try {
        const data = JSON.parse(event.data) as ProgressData;
        setMessages(prev => [...prev, formatProgressMessage(data)]);
      } catch (error) {
        console.error('[FRONTEND-DEBUG] Error parsing search complete event:', {
          error,
          rawData: event.data
        });
      }
    });

    eventSource.addEventListener('error', (event: MessageEvent) => {
      console.log('[FRONTEND-DEBUG] Error event received:', {
        data: event.data,
        parsedData: tryParseJson(event.data)
      });
      
      try {
        const data = JSON.parse(event.data) as ProgressData;
        setMessages(prev => [...prev, `Error: ${data.message || 'Unknown error'}`]);
      } catch (error) {
        console.error('[FRONTEND-DEBUG] Error parsing error event:', {
          error,
          rawData: event.data
        });
      }
    });

    eventSource.onerror = (error) => {
      console.error('[FRONTEND-DEBUG] SSE connection error:', error);
      setIsConnected(false);
      setMessages(prev => [...prev, 'SSE connection error']);
    };

    return () => {
      console.log('[FRONTEND-DEBUG] Cleaning up SSE connection');
      eventSource.close();
    };
  }, []);

  function tryParseJson(data: string) {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  function formatProgressMessage(data: ProgressData): string {
    if (!data) return 'Progress update received (no data)';
    
    if (data.type === 'searchStart') {
      return `Starting search: ${data.query}`;
    }
    
    if (data.type === 'searchResult') {
      return `Found result: ${data.title} (${data.url})`;
    }
    
    if (data.type === 'searchComplete') {
      return `Search complete: Found ${data.results?.length || 0} results`;
    }

    if (data.type === 'scrapeError') {
      return `Error: ${data.message}`;
    }
    
    return `Progress update: ${JSON.stringify(data)}`;
  }

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