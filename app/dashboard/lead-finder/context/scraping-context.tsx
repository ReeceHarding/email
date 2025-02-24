"use client"

import React, { createContext, useContext, useRef, useState, ReactNode } from "react"

type MessageType = "info" | "error" | "search" | "scrape" | "business" | "warn";

interface Message {
  text: string;
  type: MessageType;
  timestamp: Date;
}

interface ScrapingContextType {
  eventSource: EventSource | null;
  setEventSource: (source: EventSource | null) => void;
  messages: Message[];
  addMessage: (text: string, type: MessageType) => void;
}

const ScrapingContext = createContext<ScrapingContextType>({
  eventSource: null,
  setEventSource: () => {},
  messages: [],
  addMessage: () => {}
});

export function ScrapingProvider({ children }: { children: ReactNode }) {
  console.log("[ScrapingProvider] Initializing context...");

  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  function addMessage(text: string, type: MessageType) {
    console.log("[ScrapingProvider:addMessage]", text, type);
    setMessages((prev) => [...prev, { text, type, timestamp: new Date() }]);
  }

  return (
    <ScrapingContext.Provider value={{ eventSource, setEventSource, messages, addMessage }}>
      {children}
    </ScrapingContext.Provider>
  );
}

export function useScrapingContext() {
  return useContext(ScrapingContext);
} 