"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import GmailConnectButton from "@/components/gmail-connect-button";
import { checkGmailConnectionAction } from "@/actions/db/users-actions";

/**
 * This client component shows a simple input box for the user to provide a natural language query
 * (e.g. "dentists in Texas") and kicks off a search and scrape job.
 */
export default function DashboardActions({ userClerkId }: { userClerkId: string }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasGmailConnected, setHasGmailConnected] = useState(false);
  const router = useRouter();

  // Check if user has Gmail connected
  async function checkGmailConnection() {
    try {
      const result = await checkGmailConnectionAction(userClerkId);
      if (result.isSuccess) {
        setHasGmailConnected(result.data);
      }
    } catch (err) {
      console.error("Error checking Gmail connection:", err);
    }
  }

  // Call on mount
  useEffect(() => {
    checkGmailConnection();
  }, []);

  async function handleSearch() {
    try {
      setLoading(true);
      
      // Redirect to the lead finder page with the query
      router.push(`/dashboard/lead-finder?q=${encodeURIComponent(query)}`);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-x-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "dentists in Texas" or "chiropractors in California"'
            className="border p-2 rounded w-96"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "Searching..." : "Find Leads"}
          </button>
        </div>

        <GmailConnectButton hasGmailConnected={hasGmailConnected} />
      </div>
    </div>
  );
} 