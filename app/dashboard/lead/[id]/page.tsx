import { db } from "@/db/db";
import { leads, emails } from "@/db/schema";
import { eq } from "drizzle-orm";
import EmailThread from "./_components/EmailThread";
import DraftEmailForm from "./_components/DraftEmailForm";

interface LeadPageProps {
  params: { id: string };
}

/**
 * This is a server component showing lead details plus the email thread
 */
export default async function LeadDetailPage({ params }: LeadPageProps) {
  const leadId = parseInt(params.id, 10);
  // In real usage, get userClerkId from your session/auth
  const userClerkId = "test_user_123";

  // Load the lead from DB
  const leadRecord = await db.query.leads.findFirst({
    where: eq(leads.id, leadId)
  });
  if (!leadRecord) {
    return <div className="p-4">Lead not found</div>;
  }

  // Load conversation from your "emails" table
  const conversation = await db.query.emails.findMany({
    where: eq(emails.leadId, String(leadId))
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">
        Lead #{leadRecord.id}: {leadRecord.companyName || leadRecord.websiteUrl}
      </h2>

      <EmailThread conversation={conversation} />

      <DraftEmailForm lead={leadRecord} userClerkId={userClerkId} />
    </div>
  );
} 