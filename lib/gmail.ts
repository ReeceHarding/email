import { google } from "googleapis";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Gets an authorized Gmail client for a user
 * Automatically handles token refresh and updates the database
 * @param userId - The ID of the user
 * @returns A configured Gmail client
 */
export async function getGmailClient(userId: string) {
  console.log("[Gmail Client] Getting authorized client for user:", userId);
  
  // Get user record with Gmail tokens
  const user = await db.query.users.findFirst({
    where: eq(usersTable.userId, userId)
  });
  
  if (!user) {
    throw new Error(`No user found with ID: ${userId}`);
  }
  
  if (!user.gmailAccessToken || !user.gmailRefreshToken) {
    throw new Error("User has not connected their Gmail account");
  }
  
  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT
  );
  
  // Set credentials
  oauth2Client.setCredentials({
    access_token: user.gmailAccessToken,
    refresh_token: user.gmailRefreshToken
  });
  
  // Set up listener to update tokens when refreshed
  oauth2Client.on("tokens", async (tokens) => {
    console.log("[Gmail Client] Tokens refreshed for user:", userId);
    try {
      const updateData: Record<string, string> = {};
      
      if (tokens.access_token) {
        updateData.gmailAccessToken = tokens.access_token;
      }
      
      if (tokens.refresh_token) {
        updateData.gmailRefreshToken = tokens.refresh_token;
      }
      
      if (Object.keys(updateData).length > 0) {
        await db.update(usersTable)
          .set(updateData)
          .where(eq(usersTable.userId, userId));
        console.log("[Gmail Client] Updated tokens in database for user:", userId);
      }
    } catch (error) {
      console.error("[Gmail Client] Error updating tokens:", error);
    }
  });
  
  // Return the Gmail client
  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * Sends an email using Gmail
 * @param options - Email options including recipient, subject, and body
 * @returns Email thread and message IDs
 */
export async function sendEmail({
  userId,
  to,
  subject,
  body,
  cc,
  bcc
}: {
  userId: string;
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}): Promise<{ threadId: string; messageId: string }> {
  console.log("[Gmail Send] Sending email for user:", userId);
  
  try {
    // Get Gmail client
    const gmail = await getGmailClient(userId);
    
    // Construct email headers
    const headers = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/html; charset=utf-8",
      "MIME-Version: 1.0"
    ];
    
    // Add CC and BCC if provided
    if (cc) headers.push(`Cc: ${cc}`);
    if (bcc) headers.push(`Bcc: ${bcc}`);
    
    // Construct full email
    const emailLines = [...headers, "", body];
    const email = emailLines.join("\r\n");
    
    // Encode as base64url (Gmail API requirement)
    const encodedEmail = Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    
    // Send the email
    console.log("[Gmail Send] Sending email to:", to);
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedEmail
      }
    });
    
    // Extract IDs from response
    const threadId = response.data.threadId || "";
    const messageId = response.data.id || "";
    
    console.log("[Gmail Send] Email sent successfully. Thread ID:", threadId, "Message ID:", messageId);
    return { threadId, messageId };
  } catch (error) {
    console.error("[Gmail Send] Error sending email:", error);
    throw error;
  }
}

/**
 * Checks if a user has connected their Gmail account
 * @param userId - The ID of the user
 * @returns True if the user has connected Gmail
 */
export async function hasGmailConnected(userId: string): Promise<boolean> {
  console.log("[Gmail Check] Checking if user has connected Gmail:", userId);
  
  try {
    const user = await db.query.users.findFirst({
      where: eq(usersTable.userId, userId)
    });
    
    if (!user) {
      console.log("[Gmail Check] User not found:", userId);
      return false;
    }
    
    const isConnected = !!(user.gmailAccessToken && user.gmailRefreshToken);
    console.log("[Gmail Check] Gmail connected:", isConnected);
    return isConnected;
  } catch (error) {
    console.error("[Gmail Check] Error checking Gmail connection:", error);
    return false;
  }
}

/**
 * Disconnects a user's Gmail account by removing their tokens
 * @param userId - The ID of the user
 * @returns True if disconnected successfully
 */
export async function disconnectGmail(userId: string): Promise<boolean> {
  console.log("[Gmail Disconnect] Disconnecting Gmail for user:", userId);
  
  try {
    await db.update(usersTable)
      .set({
        gmailAccessToken: null,
        gmailRefreshToken: null
      })
      .where(eq(usersTable.userId, userId));
    
    console.log("[Gmail Disconnect] Gmail disconnected successfully for user:", userId);
    return true;
  } catch (error) {
    console.error("[Gmail Disconnect] Error disconnecting Gmail:", error);
    return false;
  }
} 