"use client";

import { useEffect, useState, useRef } from "react";

interface MessageEvent {
  data: string;
}

interface ProgressMessage {
  timestamp: Date;
  text: string;
  type: 'search' | 'scrape' | 'business' | 'info' | 'error';
}

export default function ScrapingProgress() {
  const [messages, setMessages] = useState<ProgressMessage[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const eventSource = new EventSource("/api/search/scrape-stream");
    eventSourceRef.current = eventSource;

    // Helper to add a message
    const addMessage = (text: string, type: ProgressMessage['type'] = 'info') => {
      setMessages(prev => [...prev, { timestamp: new Date(), text, type }]);
    };

    // Handle different event types
    const handleEvent = (event: MessageEvent, eventName: string) => {
      if (!event?.data) return;
      try {
        const data = JSON.parse(event.data);
        let message = '';
        let type: ProgressMessage['type'] = 'info';

        switch (eventName) {
          case 'searchStart':
            message = `🔍 Starting search for: ${data.query}`;
            type = 'search';
            break;
          case 'searchResult':
            message = `📍 Found: ${data.title}`;
            type = 'search';
            break;
          case 'searchComplete':
            message = `✅ Search complete: Found ${data.count} results for "${data.query}"`;
            type = 'search';
            break;
          case 'scrapeStart':
            message = `🌐 Scraping website: ${data.url}`;
            type = 'scrape';
            break;
          case 'scrapeComplete':
            message = `✅ Finished scraping: ${data.url}`;
            type = 'scrape';
            break;
          case 'businessProfile':
            message = `🏢 Found business: ${data.name || 'Unknown'}${data.phone ? ` (${data.phone})` : ''}${data.email ? ` - ${data.email}` : ''}`;
            type = 'business';
            break;
          case 'error':
            message = `⚠️ Error: ${data.message || JSON.stringify(data)}`;
            type = 'error';
            break;
          default:
            // Handle raw log messages
            if (typeof event.data === 'string' && event.data.includes('[log]')) {
              const logMessage = event.data.split('[log] ')[1];
              if (logMessage) {
                message = logMessage;
                type = 'info';
              }
            } else {
              message = event.data;
              type = 'info';
            }
        }

        if (message) {
          addMessage(message, type);
        }
      } catch (err) {
        // If we can't parse the data, just show it as is
        if (event.data) {
          addMessage(event.data, 'info');
        }
      }
    };

    // Map events to handlers
    const events = [
      'searchStart',
      'searchResult',
      'searchComplete',
      'scrapeStart',
      'scrapeComplete',
      'businessProfile',
      'error',
      'message'
    ];

    // Add listeners for all events
    events.forEach(eventName => {
      if (eventName === 'message') {
        eventSource.onmessage = (e) => handleEvent(e, 'message');
      } else {
        eventSource.addEventListener(eventName, (e) => handleEvent(e, eventName));
      }
    });

    // Handle connection error
    eventSource.onerror = () => {
      addMessage("Connection error or closed", 'error');
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div className="mt-4">
      <h3 className="font-semibold mb-2">Real-time Progress:</h3>
      
      <div className="bg-white rounded-lg border shadow-sm max-h-96 overflow-y-auto">
        {messages.length > 0 ? (
          <div className="divide-y">
            {messages.map((msg, i) => {
              let bgColor = "hover:bg-gray-50";
              
              switch (msg.type) {
                case 'search':
                  bgColor = "hover:bg-blue-50 bg-blue-50/50";
                  break;
                case 'scrape':
                  bgColor = "hover:bg-purple-50 bg-purple-50/50";
                  break;
                case 'business':
                  bgColor = "hover:bg-green-50 bg-green-50/50";
                  break;
                case 'error':
                  bgColor = "hover:bg-red-50 bg-red-50/50";
                  break;
                default:
                  bgColor = "hover:bg-gray-50";
              }
              
              return (
                <div key={i} className={`p-3 text-sm transition-colors ${bgColor}`}>
                  <div className="flex items-start gap-2">
                    <span className="flex-grow">{msg.text}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="p-4 text-center text-gray-500 text-sm italic">
            Waiting for progress updates...
          </div>
        )}
      </div>
    </div>
  );
} 