import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db/db";
import { google } from "googleapis";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { processIncomingEmailAction } from "@/actions/db/email-responses-actions";

/**
 * Gmail webhook endpoint for receiving notifications of email updates
 * This endpoint receives push notifications from Gmail when new emails arrive
 * or when emails are updated.
 * 
 * The notification data includes:
 * - X-Goog-Resource-ID: The resource ID that triggered the notification
 * - X-Goog-Resource-State: The state of the resource (exists, update, etc.)
 * - X-Goog-Resource-URI: The URI of the resource
 * - X-Goog-Message-Number: The message number
 * - X-Goog-Channel-ID: The ID of the notification channel
 * - X-Goog-Channel-Token: The validation token for the notification
 * - X-Goog-Channel-Expiration: The expiration time of the notification channel
 */
export async function POST(req: NextRequest) {
  console.log("[Gmail Webhook] Notification received");
  
  // Verify the request signature if configured
  if (process.env.GMAIL_WEBHOOK_SECRET) {
    const signature = req.headers.get("x-goog-signature");
    
    if (!signature) {
      console.error("[Gmail Webhook] Missing signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    
    // Verify signature logic would go here
    // This is a simplified example as Gmail uses a complex signature mechanism
  }
  
  try {
    // Get notification headers
    const resourceState = req.headers.get("x-goog-resource-state");
    const resourceId = req.headers.get("x-goog-resource-id");
    const channelId = req.headers.get("x-goog-channel-id");
    const messageNumber = req.headers.get("x-goog-message-number");
    
    console.log(`[Gmail Webhook] Resource state: ${resourceState}, Resource ID: ${resourceId}, Channel ID: ${channelId}`);
    
    // Parse the channel ID to get the user ID
    // Format: user-{userId}-{random}
    let userId: string | null = null;
    
    if (channelId) {
      const match = channelId.match(/^user-([^-]+)/);
      if (match && match[1]) {
        userId = match[1];
      }
    }
    
    if (!userId) {
      console.error("[Gmail Webhook] Could not extract user ID from channel ID");
      return NextResponse.json({ error: "Invalid channel ID" }, { status: 400 });
    }
    
    // Check if notification is about a change that requires action
    if (resourceState === "exists" || resourceState === "update") {
      // Get user's Gmail tokens
      const user = await db.query.users.findFirst({
        where: eq(usersTable.userId, userId),
        columns: {
          gmailAccessToken: true,
          gmailRefreshToken: true
        }
      });
      
      if (!user?.gmailAccessToken || !user?.gmailRefreshToken) {
        console.error("[Gmail Webhook] User has no Gmail tokens:", userId);
        return NextResponse.json({ error: "No Gmail tokens for user" }, { status: 400 });
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
      
      try {
        // Get the history ID from the notification
        const historyId = resourceId;
        
        if (!historyId) {
          console.error("[Gmail Webhook] Missing history ID");
          return NextResponse.json({ error: "Missing history ID" }, { status: 400 });
        }
        
        // Process incoming email using our new action
        const result = await processIncomingEmailAction(userId, historyId);
        
        if (!result.isSuccess) {
          console.error("[Gmail Webhook] Error processing incoming email:", result.message);
        } else {
          console.log(`[Gmail Webhook] Successfully processed ${result.data.length} email responses`);
        }
      } catch (processError: any) {
        console.error("[Gmail Webhook] Error processing notification:", processError);
        // Continue and return success to Gmail - we don't want to fail the webhook
      }
    }
    
    // Return a 200 OK to acknowledge receipt of the notification
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error("[Gmail Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: error.message || "An error occurred processing the webhook" },
      { status: 500 }
    );
  }
} 