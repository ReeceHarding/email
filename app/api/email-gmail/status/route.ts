import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Gmail API endpoint for checking connection status
 * 
 * Accepts GET requests with the following query parameters:
 * - userId: The user ID to check Gmail connection for
 * 
 * Returns:
 * {
 *   connected: boolean;
 *   email?: string;
 *   scopes?: string[];
 *   error?: string;
 * }
 */
export async function GET(req: NextRequest) {
  console.log("[Gmail Status] Request received");
  
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    
    if (!userId) {
      return NextResponse.json(
        { connected: false, error: "User ID is required" },
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
      return NextResponse.json({ connected: false });
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
    
    // Check token validity and get token info
    try {
      const tokenInfo = await oauth2Client.getTokenInfo(user.gmailAccessToken);
      const scopes = tokenInfo.scopes || [];
      
      // Create Gmail API client
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      
      // Get user profile to verify connection and get email
      const profile = await gmail.users.getProfile({ userId: 'me' });
      
      return NextResponse.json({
        connected: true,
        email: profile.data.emailAddress,
        scopes
      });
    } catch (error: any) {
      console.log("[Gmail Status] Error checking token:", error);
      
      // Try to refresh token
      try {
        console.log("[Gmail Status] Attempting to refresh token...");
        const response = await oauth2Client.refreshAccessToken();
        const tokens = response.credentials;
        
        if (tokens.access_token) {
          // Update token in database
          await db.update(usersTable)
            .set({ gmailAccessToken: tokens.access_token })
            .where(eq(usersTable.userId, userId));
          
          // Try again with the new token
          const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
          const profile = await gmail.users.getProfile({ userId: 'me' });
          
          return NextResponse.json({
            connected: true,
            email: profile.data.emailAddress,
            scopes: []  // We don't have scope info after refresh
          });
        } else {
          throw new Error("No access token in refresh response");
        }
      } catch (refreshError) {
        console.error("[Gmail Status] Error refreshing token:", refreshError);
        return NextResponse.json({
          connected: false,
          error: "Token expired and refresh failed"
        });
      }
    }
  } catch (error: any) {
    console.error("[Gmail Status] Unexpected error:", error);
    return NextResponse.json(
      { connected: false, error: error.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
} 