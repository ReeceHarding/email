import { NextResponse } from "next/server"
import { google } from "googleapis"

/**
 * This route initiates the Gmail OAuth flow by redirecting to Google's consent screen.
 * The user will be asked to grant access to their Gmail account.
 */
export async function GET() {
  // For now, we'll use a test user ID since auth is not implemented
  const testClerkId = "test_user_123"

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT
  )

  // Generate the auth URL with the required scopes
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly"
    ],
    // Pass the user ID in the state parameter
    state: testClerkId
  })

  // Redirect to Google's consent screen
  return NextResponse.redirect(authUrl)
} 