import { NextResponse } from "next/server"
import { google } from "googleapis"
import { auth } from "@clerk/nextjs/server"

/**
 * This route initiates the Gmail OAuth flow by redirecting to Google's consent screen.
 * The user will be asked to grant access to their Gmail account.
 * 
 * The redirect URL should be: https://your-domain.com/api/integrations/gmail/callback
 * Make sure this exact URL is added to your Google Cloud Console's "Authorized redirect URIs".
 */
export async function GET() {
  console.log("[Gmail Integrations] Starting Gmail OAuth flow...")

  // Get the authenticated user's ID
  const { userId } = await auth()
  if (!userId) {
    console.log("[Gmail Integrations] No authenticated user found")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    // The redirect URL must match exactly what's in your Google Cloud Console
    process.env.GOOGLE_OAUTH_REDIRECT // e.g. "https://your-domain.com/api/integrations/gmail/callback"
  )

  // Generate the auth URL with the required scopes
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly"
    ],
    // Pass the user ID in the state parameter
    state: userId
  })

  console.log("[Gmail Integrations] Generated Google Auth URL for user:", userId)
  return NextResponse.redirect(authUrl)
} 