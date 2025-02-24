import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { leads, emails } from "@/db/schema";
import { eq } from "drizzle-orm";
import { draftEmailWithClaude } from "@/lib/ai";
import { sendGmail } from "@/lib/google";
import { auth } from "@clerk/nextjs/server";

interface EmailBody {
  action: "draft" | "send";
  subject?: string;
  body?: string;
}

/**
 * A route that can handle:
 * 1) Drafting an email with AI
 * 2) Sending the final email via Gmail
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  console.log("[LeadEmailRoute] Called with params:", params)
  try {
    const leadId = parseInt(params.id, 10);
    const { action, subject, body } = (await req.json()) as EmailBody;

    // Get the authenticated user's ID
    const { userId } = await auth()
    if (!userId) {
      console.log("[LeadEmailRoute] No authenticated user found")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Retrieve lead from DB
    const leadRecord = await db.query.leads.findFirst({
      where: eq(leads.id, leadId)
    });
    if (!leadRecord) {
      console.log("[LeadEmailRoute] Lead not found:", leadId)
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    try {
      if (action === "draft") {
        // Convert lead record to format expected by draftEmailWithClaude
        const leadData = {
          businessName: leadRecord.companyName || undefined,
          contactEmail: leadRecord.contactEmail || undefined,
          phoneNumber: leadRecord.phoneNumber || undefined,
          address: leadRecord.address || undefined,
          industry: leadRecord.industry || undefined,
          description: leadRecord.description || undefined,
          websiteUrl: leadRecord.websiteUrl
        };
        
        console.log("[LeadEmailRoute] Generating draft for lead:", leadData)
        const { subject: draftSubject, body: draftBody } = await draftEmailWithClaude(leadData);
        return NextResponse.json({
          subject: draftSubject,
          body: draftBody
        });
      }

      if (action === "send") {
        if (!subject || !body) {
          return NextResponse.json({ error: "Missing subject/body for send" }, { status: 400 });
        }

        // Send via Gmail
        const toEmail = leadRecord.contactEmail;
        if (!toEmail) {
          return NextResponse.json({ error: "Lead has no contact email" }, { status: 400 });
        }

        console.log("[LeadEmailRoute] Sending email to:", toEmail)
        const { threadId, messageId } = await sendGmail({
          userClerkId: userId,
          to: toEmail,
          subject,
          body
        });

        // Store in emails table
        await db.insert(emails).values({
          leadId: String(leadRecord.id),
          direction: "outbound",
          content: body,
          threadId,
          messageId,
          isDraft: false,
          needsApproval: false,
          sentAt: new Date()
        });

        // Update lead status
        await db.update(leads)
          .set({ status: "emailed", updatedAt: new Date() })
          .where(eq(leads.id, leadRecord.id));

        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    } catch (err: any) {
      console.error("[LeadEmailRoute] Error:", err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  } catch (error) {
    console.error("[LeadEmailRoute] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
} 