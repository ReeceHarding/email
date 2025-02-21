import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { leads } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Simple tracking route for email open or click events.
 * usage:
 *   <img src="https://yourapp.com/api/track?leadId=123&type=open" />
 *   <a href="https://yourapp.com/api/track?leadId=123&type=click&url=DESTINATION_URL">Click</a>
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId");
  const type = searchParams.get("type");
  const url = searchParams.get("url");

  if (!leadId || !type) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  try {
    if (type === "open") {
      // Mark lead as opened or log an event
      await db.update(leads)
        .set({ status: "opened" })
        .where(eq(leads.id, parseInt(leadId, 10)));
      // Return a 1x1 transparent GIF
      const gif = Buffer.from("R0lGODlhAQABAPAAAP///wAAACwAAAAAAQABAEACAkQBADs=", "base64");
      return new NextResponse(gif, {
        status: 200,
        headers: {
          "Content-Type": "image/gif"
        }
      });
    } else if (type === "click" && url) {
      // Mark lead as clicked
      await db.update(leads)
        .set({ status: "clicked" })
        .where(eq(leads.id, parseInt(leadId, 10)));
      return NextResponse.redirect(url);
    }

    // If the 'type' is unrecognized or missing 'url' for click
    return new NextResponse("OK");
  } catch (err) {
    console.error("[Track] Error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 