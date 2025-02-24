import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * OAuth callback route for handling the Google authorization code
 * This should match exactly what's configured in Google Cloud Console:
 * http://localhost:3000/api/email-gmail/oauth-callback (for development)
 * https://your-domain.com/api/email-gmail/oauth-callback (for production)
 * 
 * Exchanges the authorization code for tokens and stores them in the database
 */
export async function GET(req: NextRequest) {
  console.log("[Gmail OAuth Callback] Request received:", req.url);
  
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // Contains the user ID
    const error = url.searchParams.get("error");
    
    // Check for OAuth errors
    if (error) {
      console.error("[Gmail OAuth Callback] Google returned an error:", error);
      return redirectWithError("Authorization was denied or an error occurred");
    }
    
    // Validate required parameters
    if (!code) {
      console.error("[Gmail OAuth Callback] Missing authorization code");
      return redirectWithError("Missing authorization code");
    }
    
    if (!state) {
      console.error("[Gmail OAuth Callback] Missing state parameter");
      return redirectWithError("Missing state parameter");
    }
    
    // Lookup user by ID
    console.log("[Gmail OAuth Callback] Looking up user with ID:", state);
    const user = await db.query.users.findFirst({
      where: eq(usersTable.userId, state)
    });
    
    if (!user) {
      console.error("[Gmail OAuth Callback] No user found with ID:", state);
      return redirectWithError("User not found");
    }
    
    // Initialize OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT
    );
    
    try {
      // Exchange code for tokens
      console.log("[Gmail OAuth Callback] Exchanging authorization code for tokens...");
      const { tokens } = await oauth2Client.getToken(code);
      
      // Validate tokens
      if (!tokens.access_token) {
        throw new Error("Missing access token in OAuth response");
      }
      
      // Note: tokens.refresh_token might not be present if the user has already granted access
      // and is re-authenticating. We should only update it if it's present.
      const updateData: Record<string, string> = {
        gmailAccessToken: tokens.access_token
      };
      
      if (tokens.refresh_token) {
        updateData.gmailRefreshToken = tokens.refresh_token;
      }
      
      // Store tokens in database
      console.log("[Gmail OAuth Callback] Storing tokens for user:", user.userId);
      await db.update(usersTable)
        .set(updateData)
        .where(eq(usersTable.userId, state));
      
      // Redirect to test page with success message
      const redirectUrl = new URL("/test-auth.html", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
      redirectUrl.searchParams.set("message", "Gmail connected successfully");
      return NextResponse.redirect(redirectUrl);
      
    } catch (error) {
      console.error("[Gmail OAuth Callback] Token exchange error:", error);
      return redirectWithError("Failed to connect Gmail. Please try again.");
    }
    
  } catch (error) {
    console.error("[Gmail OAuth Callback] Unexpected error:", error);
    return redirectWithError("An unexpected error occurred");
  }
}

/**
 * Helper function to redirect with an error message
 */
function redirectWithError(errorMessage: string): NextResponse {
  const redirectUrl = new URL("/test-auth.html", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
  redirectUrl.searchParams.set("error", errorMessage);
  return NextResponse.redirect(redirectUrl);
} 