import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Gmail API endpoint for sending emails
 * 
 * Accepts POST requests with the following body:
 * {
 *   userId: string;
 *   to: string;
 *   subject: string;
 *   body: string;
 *   cc?: string[];
 *   bcc?: string[];
 *   replyTo?: string;
 * }
 * 
 * Returns:
 * {
 *   success: boolean;
 *   messageId?: string;
 *   error?: string;
 * }
 */
export async function POST(req: NextRequest) {
  console.log("[Gmail Send] Request received");
  
  try {
    // Parse request body
    const body = await req.json();
    const { userId, to, subject, body: emailBody, cc, bcc, replyTo } = body;
    
    // Validate required fields
    if (!userId) {
      return NextResponse.json({ success: false, error: "User ID is required" }, { status: 400 });
    }
    
    if (!to) {
      return NextResponse.json({ success: false, error: "Recipient email is required" }, { status: 400 });
    }
    
    if (!subject) {
      return NextResponse.json({ success: false, error: "Subject is required" }, { status: 400 });
    }
    
    if (!emailBody) {
      return NextResponse.json({ success: false, error: "Email body is required" }, { status: 400 });
    }
    
    // Get user's Gmail tokens
    const user = await db.query.users.findFirst({
      where: eq(usersTable.userId, userId),
      columns: {
        gmailAccessToken: true,
        gmailRefreshToken: true
      }
    });
    
    if (!user?.gmailAccessToken || !user?.gmailRefreshToken) {
      return NextResponse.json(
        { success: false, error: "Gmail is not connected. Please connect your Gmail account first." },
        { status: 401 }
      );
    }
    
    // Initialize OAuth client
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
    
    // Create Gmail API client
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Check if token is expired and refresh if needed
    try {
      await oauth2Client.getTokenInfo(user.gmailAccessToken);
    } catch (error) {
      console.log("[Gmail Send] Token expired or invalid, refreshing...");
      
      try {
        // Refresh access token
        const response = await oauth2Client.refreshAccessToken();
        const tokens = response.credentials;
        
        // Update tokens in database if refreshed successfully
        if (tokens.access_token) {
          await db.update(usersTable)
            .set({ gmailAccessToken: tokens.access_token })
            .where(eq(usersTable.userId, userId));
        } else {
          throw new Error("Failed to refresh token: No access token returned");
        }
      } catch (refreshError) {
        console.error("[Gmail Send] Error refreshing token:", refreshError);
        throw new Error("Failed to refresh Gmail access token");
      }
    }
    
    // Compose email
    // Format recipients
    const recipients = [];
    recipients.push(`To: ${to}`);
    
    if (cc && cc.length > 0) {
      recipients.push(`Cc: ${cc.join(', ')}`);
    }
    
    if (bcc && bcc.length > 0) {
      recipients.push(`Bcc: ${bcc.join(', ')}`);
    }
    
    // Add Reply-To header if provided
    const replyToHeader = replyTo ? `Reply-To: ${replyTo}\r\n` : '';
    
    // Compose the raw email
    const emailLines = [
      `From: me`,
      recipients.join('\r\n'),
      `Subject: ${subject}`,
      replyToHeader,
      'Content-Type: text/html; charset=utf-8',
      '',
      emailBody
    ];
    
    const email = emailLines.join('\r\n');
    
    // Encode the email in base64
    const encodedEmail = Buffer.from(email).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    // Send the email
    console.log("[Gmail Send] Sending email...");
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });
    
    console.log("[Gmail Send] Email sent successfully:", response.data.id);
    
    return NextResponse.json({
      success: true,
      messageId: response.data.id
    });
    
  } catch (error: any) {
    console.error("[Gmail Send] Error sending email:", error);
    
    // Check if error is due to authentication
    if (error.message?.includes('invalid_grant') || error.message?.includes('Invalid Credentials')) {
      return NextResponse.json(
        { success: false, error: "Gmail authentication failed. Please reconnect your Gmail account." },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
} 