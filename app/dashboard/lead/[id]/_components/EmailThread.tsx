"use client";

import { Email } from "@/db/schema";

export default function EmailThread({ conversation }: { conversation: Email[] }) {
  if (!conversation || conversation.length === 0) {
    return <div className="p-2 text-sm text-gray-500">No emails yet.</div>;
  }

  return (
    <div className="border p-4 rounded space-y-4 bg-gray-50">
      {conversation.map((msg) => {
        const isOutbound = msg.direction === "outbound";
        return (
          <div
            key={msg.id}
            className={`p-3 rounded ${
              isOutbound ? "bg-blue-100" : "bg-green-100"
            }`}
          >
            <div className="text-xs text-gray-500">
              {isOutbound ? "You" : "Lead"} - {msg.createdAt?.toLocaleString()}
            </div>
            <div className="mt-1 text-sm whitespace-pre-wrap">{msg.content}</div>
          </div>
        );
      })}
    </div>
  );
} 