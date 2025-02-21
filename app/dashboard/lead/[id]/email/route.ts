import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { leads, emails } from "@/db/schema";
import { eq } from "drizzle-orm";
import { draftEmailWithClaude } from "@/lib/ai"; // hypothetically using Anthropic or GPT
import { sendGmail } from "@/lib/google";

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
  const leadId = parseInt(params.id, 10);
  const { action, subject, body } = (await req.json()) as EmailBody;

  // In real usage, get userClerkId from session. We'll use a placeholder:
  const userClerkId = "test_user_123";

  // 1) Retrieve lead from DB
  const leadRecord = await db.query.leads.findFirst({
    where: eq(leads.id, leadId)
  });
  if (!leadRecord) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  try {
    if (action === "draft") {
      // Convert lead record to ScrapeResult format
      const leadData = {
        businessName: leadRecord.companyName || undefined,
        contactEmail: leadRecord.contactEmail || undefined,
        phoneNumber: leadRecord.phoneNumber || undefined,
        address: leadRecord.address || undefined,
        industry: leadRecord.industry || undefined,
        description: leadRecord.description || undefined,
        websiteUrl: leadRecord.websiteUrl
      };
      
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
      // Actually send via Gmail
      const toEmail = leadRecord.contactEmail || "test@example.com";
      const { threadId, messageId } = await sendGmail({
        userClerkId,
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
} 