import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Gmail API endpoint for disconnecting Gmail integration
 * 
 * Accepts POST requests with the following body:
 * {
 *   userId: string;
 * }
 * 
 * Returns:
 * {
 *   success: boolean;
 *   error?: string;
 * }
 */
export async function POST(req: NextRequest) {
  console.log("[Gmail Disconnect] Request received");
  
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
    
    // If user has a token, try to revoke it
    if (user?.gmailAccessToken) {
      try {
        // Initialize OAuth client
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_OAUTH_REDIRECT
        );
        
        // Revoke access token
        await oauth2Client.revokeToken(user.gmailAccessToken);
        console.log("[Gmail Disconnect] Access token revoked successfully");
      } catch (revokeError) {
        // Just log the error and continue - we'll clear the tokens from DB anyway
        console.error("[Gmail Disconnect] Error revoking token:", revokeError);
      }
    }
    
    // Clear tokens from the database regardless of revocation success
    await db.update(usersTable)
      .set({
        gmailAccessToken: null,
        gmailRefreshToken: null
      })
      .where(eq(usersTable.userId, userId));
    
    console.log("[Gmail Disconnect] Tokens cleared from database for user:", userId);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Gmail Disconnect] Error disconnecting Gmail:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to disconnect Gmail" },
      { status: 500 }
    );
  }
} 