import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { google } from "googleapis";

/**
 * Callback route for Google OAuth.
 * This should match the redirect URI configured in your Google Cloud Console:
 * https://your-domain.com/api/integrations/gmail/callback
 * 
 * We'll parse the 'code' and 'state' from query params, then exchange for tokens.
 * We store those tokens in the DB (gmailAccessToken & gmailRefreshToken).
 */
export async function GET(req: NextRequest) {
  console.log("[GmailOAuth] Called with request:", req.url)
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    // Validate required parameters
    if (!code) {
      console.log("[GmailOAuth] Missing code param.")
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }
    if (!state) {
      console.log("[GmailOAuth] Missing state param.")
      return NextResponse.json({ error: "Missing state" }, { status: 400 });
    }

    // Validate state matches a user
    console.log("[GmailOAuth] Looking up user with clerkId:", state)
    const user = await db.query.users.findFirst({
      where: eq(usersTable.userId, state)
    });

    if (!user) {
      console.log("[GmailOAuth] No user found for clerkId:", state)
      return NextResponse.json({ error: "Invalid state parameter" }, { status: 400 });
    }

    // Initialize OAuth client
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT
    );

    try {
      // Exchange code for tokens
      console.log("[GmailOAuth] Exchanging code for tokens...")
      const { tokens } = await client.getToken(code);

      // Validate tokens
      if (!tokens.access_token) {
        throw new Error("Missing access token in OAuth response");
      }
      if (!tokens.refresh_token) {
        throw new Error("Missing refresh token in OAuth response");
      }

      // Store tokens in DB
      console.log("[GmailOAuth] Storing tokens in DB for user:", user.userId)
      await db.update(usersTable)
        .set({
          gmailAccessToken: tokens.access_token,
          gmailRefreshToken: tokens.refresh_token
        })
        .where(eq(usersTable.userId, state));

      // Redirect to dashboard with success message
      console.log("[GmailOAuth] Stored tokens. Redirecting to dashboard.")
      const redirectUrl = new URL("/dashboard", url.origin);
      redirectUrl.searchParams.set("message", "Gmail connected successfully");
      return NextResponse.redirect(redirectUrl);
    } catch (error) {
      console.error("[Gmail OAuth] Token exchange error:", error);
      // Redirect to dashboard with error message
      const redirectUrl = new URL("/dashboard", url.origin);
      redirectUrl.searchParams.set("error", "Failed to connect Gmail");
      return NextResponse.redirect(redirectUrl);
    }
  } catch (error) {
    console.error("[Gmail OAuth] Unexpected error:", error);
    // Redirect to dashboard with error message
    const redirectUrl = new URL("/dashboard", req.url);
    redirectUrl.searchParams.set("error", "An unexpected error occurred");
    return NextResponse.redirect(redirectUrl);
  }
} 