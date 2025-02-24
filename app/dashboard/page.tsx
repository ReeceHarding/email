"use server"

import { db } from "@/db/db";
import { leads } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import DashboardActions from "./_components/DashboardActions";
import OffersBox from "./_components/OffersBox";

// This is an example server component for the main dashboard.
export default async function DashboardPage() {
  // In a real app, you'd get the clerk user ID from the session or server side auth:
  const userClerkId = "test_user_123"; // Replace with real logic

  // Fetch leads for this user
  const userLeads = await db.select()
    .from(leads)
    .where(eq(leads.userId, userClerkId))
    .limit(50)
    .orderBy(desc(leads.updatedAt));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Actions for adding new leads, scraping, etc. */}
      <DashboardActions userClerkId={userClerkId} />

      <table className="w-full border-collapse text-sm mt-4">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left p-2">ID</th>
            <th className="text-left p-2">Company</th>
            <th className="text-left p-2">Contact</th>
            <th className="text-left p-2">Status</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {userLeads.map((lead) => (
            <tr key={lead.id} className="border-b hover:bg-gray-50">
              <td className="p-2">{lead.id}</td>
              <td className="p-2">{lead.companyName ?? lead.websiteUrl}</td>
              <td className="p-2">{lead.contactEmail ?? "N/A"}</td>
              <td className="p-2">{lead.status}</td>
              <td className="p-2">
                <Link
                  className="text-blue-600 hover:underline"
                  href={`/dashboard/lead/${lead.id}`}
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add the Offers Box below */}
      <OffersBox userClerkId={userClerkId} />
    </div>
  );
} 