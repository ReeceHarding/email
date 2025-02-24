"use client";

import { useEffect, useRef } from "react";
import { useScrapingContext } from "../context/scraping-context";

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