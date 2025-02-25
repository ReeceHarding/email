"use client";

import { useEffect, useRef } from "react";
import { useScrapingContext } from "../context/scraping-context";
import { CircleAlert, InfoIcon, Search, Globe, Building, CheckCircle, ServerCrash } from "lucide-react";

/**
 * This shows the real-time progress logs in a scrollable box.
 */
export default function ScrapingProgress() {
  const { messages } = useScrapingContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    console.log("[ScrapingProgress] Messages updated. Count =", messages.length)
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  console.log("[ScrapingProgress] Render. Message count =", messages.length)

  // Function to get the appropriate icon for each message type
  const getMessageIcon = (type: string) => {
    switch(type) {
      case 'error':
        return <CircleAlert className="h-4 w-4 text-red-500 flex-shrink-0" />;
      case 'search':
        return <Search className="h-4 w-4 text-blue-500 flex-shrink-0" />;
      case 'scrape':
        return <Globe className="h-4 w-4 text-purple-500 flex-shrink-0" />;
      case 'business':
        return <Building className="h-4 w-4 text-green-500 flex-shrink-0" />;
      case 'warn':
        return <ServerCrash className="h-4 w-4 text-yellow-500 flex-shrink-0" />;
      default:
        return <InfoIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />;
    }
  };

  return (
    <div className="max-h-[500px] overflow-y-auto rounded-md border">
      {messages.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {messages.map((msg, i) => {
            let classes = "";
            
            switch (msg.type) {
              case 'search':
                classes = "border-l-4 border-blue-400 bg-blue-50";
                break;
              case 'scrape':
                classes = "border-l-4 border-purple-400 bg-purple-50";
                break;
              case 'business':
                classes = "border-l-4 border-green-400 bg-green-50";
                break;
              case 'error':
                classes = "border-l-4 border-red-400 bg-red-50";
                break;
              case 'warn':
                classes = "border-l-4 border-yellow-400 bg-yellow-50";
                break;
              default:
                classes = "bg-white";
            }
            
            return (
              <div key={i} className={`p-3 text-sm ${classes}`}>
                <div className="flex items-start gap-2">
                  {getMessageIcon(msg.type)}
                  <span className="flex-grow">{msg.text}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {msg.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      ) : (
        <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center">
          <InfoIcon className="h-8 w-8 mb-2 text-gray-400" />
          <p className="text-sm">Waiting for progress updates...</p>
          <p className="text-xs text-gray-400 mt-1">Start a search to see real-time progress</p>
        </div>
      )}
    </div>
  );
} 