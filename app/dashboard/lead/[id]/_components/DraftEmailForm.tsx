"use client";

import { useState } from "react";
import { Lead } from "@/db/schema";

export default function DraftEmailForm({
  lead,
  userClerkId
}: {
  lead: Lead;
  userClerkId: string;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGenerateDraft() {
    try {
      setLoading(true);
      // request a draft from the server
      const res = await fetch(`/dashboard/lead/${lead.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draft" })
      });
      if (!res.ok) {
        throw new Error(`Draft generation failed: ${res.status}`);
      }
      const data = await res.json();
      setSubject(data.subject || "");
      setBody(data.body || "");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendEmail() {
    try {
      setLoading(true);
      const res = await fetch(`/dashboard/lead/${lead.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", subject, body })
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Send email failed: ${errorText}`);
      }
      alert("Email sent successfully!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={handleGenerateDraft}
          disabled={loading}
          className="bg-gray-200 px-3 py-2 rounded"
        >
          Generate AI Draft
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium">Subject</label>
        <input
          type="text"
          className="w-full border p-2 rounded"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Body</label>
        <textarea
          className="w-full border p-2 rounded"
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      <div>
        <button
          onClick={handleSendEmail}
          disabled={loading || !subject.trim() || !body.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Send Email
        </button>
      </div>
    </div>
  );
} 