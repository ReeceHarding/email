import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getUser, createTestUser } from "@/lib/auth";

/**
 * This route initiates the Gmail OAuth 2.0 flow
 * It redirects the user to Google's consent screen with the required scopes
 * 
 * The redirect URL should match exactly what's configured in Google Cloud Console:
 * http://localhost:3000/api/email-gmail/oauth-callback (for development)
 * https://your-domain.com/api/email-gmail/oauth-callback (for production)
 */
export async function GET() {
  console.log("[Gmail OAuth] Starting OAuth flow...");

  try {
    // Get authenticated user's ID
    let { userId } = await getUser();
    
    // For development: If no user is authenticated, create a test user
    if (!userId && process.env.NODE_ENV !== "production") {
      console.log("[Gmail OAuth] No authenticated user, creating test user for development");
      try {
        const testUser = await createTestUser();
        userId = testUser.userId;
        console.log("[Gmail OAuth] Created test user:", userId);
      } catch (error) {
        console.error("[Gmail OAuth] Error creating test user:", error);
        // Continue with the error handling below
      }
    }
    
    if (!userId) {
      console.log("[Gmail OAuth] No authenticated user found");
      const loginUrl = new URL("/test-auth.html", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
      loginUrl.searchParams.set("error", "Please log in first");
      return NextResponse.redirect(loginUrl);
    }
    
    // Initialize OAuth 2.0 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT
    );

    // Generate authorization URL with required scopes
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline", // Gets refresh token for long-term access
      prompt: "consent", // Forces re-consent to ensure refresh token
      scope: [
        "https://www.googleapis.com/auth/gmail.send", // Send emails
        "https://www.googleapis.com/auth/gmail.readonly" // Read emails
      ],
      // Pass the user ID in the state parameter for security
      state: userId
    });

    console.log("[Gmail OAuth] Generated auth URL for user:", userId);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("[Gmail OAuth] Error generating auth URL:", error);
    return NextResponse.json(
      { error: "Failed to generate authorization URL" },
      { status: 500 }
    );
  }
} 