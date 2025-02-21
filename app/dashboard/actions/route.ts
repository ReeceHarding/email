import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { scrapeWebsite } from "@/lib/firecrawl"; // your custom scraper
import { parseBusinessData } from "@/lib/ai"; // your LLM logic if you want
import { randomUUID } from "crypto";

/**
 * Example server route to handle a POST for scraping a lead from a user-provided URL.
 * 1) Insert a new lead in "pending" or "scraping" status
 * 2) Scrape with Firecrawl
 * 3) Parse with GPT/Claude if needed
 * 4) Update the lead row
 */
export async function POST(req: NextRequest) {
  try {
    const { url, userClerkId } = await req.json() as {
      url: string;
      userClerkId: string;
    };

    if (!url || !userClerkId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1) Create a lead row
    const leadId = randomUUID(); // or use serial PK if you prefer
    await db.insert(leads).values({
      id: Number(Date.now()), // or parseInt(leadId, 10) if you changed schema
      userId: userClerkId,
      websiteUrl: url,
      status: "scraping"
    });

    // 2) Scrape the site
    const rawData = await scrapeWebsite(url);
    // 3) Optionally parse the data with GPT for better summary
    //    e.g. parseBusinessData is a hypothetical function
    // const summaryData = await parseBusinessData(rawData);

    // 4) Update the lead with data
    await db.update(leads)
      .set({
        companyName: rawData.businessData?.businessName ?? null,
        contactEmail: rawData.businessData?.contactEmail ?? null,
        status: "scraped",
        updatedAt: new Date()
      })
      .where(eq(leads.websiteUrl, url)); // or eq(leads.id, leadId) if that matches your schema

    return NextResponse.json({ message: "Scrape completed" }, { status: 200 });
  } catch (err: any) {
    console.error("[Scrape Action] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
} 