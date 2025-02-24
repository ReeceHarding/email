"use client"

import { createContext, useContext, useRef, useState, ReactNode } from "react"

interface ProgressMessage {
  timestamp: Date;
  text: string;
  type: 'search' | 'scrape' | 'business' | 'info' | 'error';
}

interface ScrapingContextType {
  messages: ProgressMessage[];
  addMessage: (text: string, type: ProgressMessage['type']) => void;
  eventSource: EventSource | null;
  setEventSource: (es: EventSource | null) => void;
}

const ScrapingContext = createContext<ScrapingContextType | null>(null);

export function ScrapingProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ProgressMessage[]>([]);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  const addMessage = (text: string, type: ProgressMessage['type'] = 'info') => {
    setMessages(prev => [...prev, { timestamp: new Date(), text, type }]);
  };

  return (
    <ScrapingContext.Provider value={{ messages, addMessage, eventSource, setEventSource }}>
      {children}
    </ScrapingContext.Provider>
  );
}

export function useScrapingContext() {
  const context = useContext(ScrapingContext);
  if (!context) {
    throw new Error('useScrapingContext must be used within a ScrapingProvider');
  }
  return context;
} 