import { google } from "googleapis";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * This function returns an authorized Gmail client for a given user.
 * It automatically attempts to refresh tokens if needed and updates the DB.
 */
export async function getAuthorizedGmailClient(userId: string) {
  // 1) Retrieve the user row from DB (make sure your 'users' table has these columns).
  //    e.g. "gmail_access_token" and "gmail_refresh_token" (snake_case or camelCase).
  const userRecord = await db.query.users.findFirst({
    where: eq(usersTable.userId, userId)
  });

  if (!userRecord) {
    throw new Error("No user found with userId " + userId);
  }
  const gmailAccessToken = userRecord.gmailAccessToken;
  const gmailRefreshToken = userRecord.gmailRefreshToken;

  if (!gmailAccessToken || !gmailRefreshToken) {
    throw new Error("User has not connected their Gmail account yet.");
  }

  // 2) Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT
  );

  oauth2Client.setCredentials({
    access_token: gmailAccessToken,
    refresh_token: gmailRefreshToken
  });

  // 3) Listen for token refresh events and update DB automatically
  oauth2Client.on("tokens", async (tokens) => {
    try {
      if (tokens.refresh_token) {
        await db.update(usersTable)
          .set({ gmailRefreshToken: tokens.refresh_token })
          .where(eq(usersTable.userId, userId));
      }
      if (tokens.access_token) {
        await db.update(usersTable)
          .set({ gmailAccessToken: tokens.access_token })
          .where(eq(usersTable.userId, userId));
      }
    } catch (err) {
      console.error("[Gmail] Error saving refreshed tokens:", err);
    }
  });

  // 4) Return the Gmail client
  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * Sends an email using the user's Gmail account.
 * @param userId - The ID of the user who owns the Gmail integration
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param body - Email body (HTML or text)
 * @returns Object containing threadId and messageId
 */
export async function sendGmail({
  userId,
  to,
  subject,
  body
}: {
  userId: string;
  to: string;
  subject: string;
  body: string;
}): Promise<{ threadId: string; messageId: string }> {
  // 1) Get an authorized Gmail client
  const gmail = await getAuthorizedGmailClient(userId);

  // 2) Construct a raw MIME email
  //    We'll use base64url encoding required by the Gmail API.
  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    "",
    body
  ];
  const rawMessage = Buffer.from(messageParts.join("\n"), "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, ""); // remove padding if present

  // 3) Send the message
  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: rawMessage
    }
  });

  const threadId = response.data.threadId || "";
  const messageId = response.data.id || "";
  return { threadId, messageId };
} 