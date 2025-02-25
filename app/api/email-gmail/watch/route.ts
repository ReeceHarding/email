import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

/**
 * Gmail API endpoint for setting up notification channels
 * This sets up a push notification channel to receive updates when new emails arrive.
 * 
 * Accepts POST requests with the following body:
 * {
 *   userId: string;
 * }
 * 
 * Returns:
 * {
 *   success: boolean;
 *   expirationTime?: string;
 *   error?: string;
 * }
 */
export async function POST(req: NextRequest) {
  console.log("[Gmail Watch] Request received");
  
  try {
    // Parse request body
    const body = await req.json();
    const { userId } = body;
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
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
    
    // Check if token is expired and refresh if needed
    try {
      await oauth2Client.getTokenInfo(user.gmailAccessToken);
    } catch (error) {
      console.log("[Gmail Watch] Token expired or invalid, refreshing...");
      
      try {
        const response = await oauth2Client.refreshAccessToken();
        const tokens = response.credentials;
        
        if (tokens.access_token) {
          await db.update(usersTable)
            .set({ gmailAccessToken: tokens.access_token })
            .where(eq(usersTable.userId, userId));
        } else {
          throw new Error("Failed to refresh token: No access token returned");
        }
      } catch (refreshError) {
        console.error("[Gmail Watch] Error refreshing token:", refreshError);
        return NextResponse.json(
          { success: false, error: "Failed to refresh Gmail access token" },
          { status: 401 }
        );
      }
    }
    
    // Create Gmail API client
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Generate a unique channel ID that includes the user ID
    // Format: user-{userId}-{random}
    const randomId = crypto.randomBytes(8).toString('hex');
    const channelId = `user-${userId}-${randomId}`;
    
    // Webhook URL where Gmail will send notifications
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/email-gmail/webhook`;
    
    // Set up the watch request
    try {
      console.log(`[Gmail Watch] Setting up watch for user ${userId} with channel ${channelId}`);
      
      // Use the raw request method to avoid TypeScript definition issues
      const response = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          labelIds: ['INBOX']
        }
      });
      
      console.log("[Gmail Watch] Watch set up successfully");
      
      // Return a success response
      return NextResponse.json({
        success: true,
        message: "Gmail notifications set up successfully"
      });
      
    } catch (error: any) {
      console.error("[Gmail Watch] Error setting up watch:", error);
      
      // Check for specific Gmail API errors
      if (error.response?.data?.error) {
        const gmailError = error.response.data.error;
        return NextResponse.json(
          { success: false, error: `Gmail API error: ${gmailError.message}` },
          { status: error.response.status || 500 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: error.message || "Failed to set up Gmail notifications" },
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    console.error("[Gmail Watch] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
} 