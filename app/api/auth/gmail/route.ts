import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { google } from "googleapis";

/**
 * Callback route for Google OAuth, e.g. "https://yourapp.com/api/auth/gmail".
 * Ensure you add this exact URL to your Google Cloud Console "Authorized redirect URIs".
 *
 * We'll parse the 'code' and 'state' from query params, then exchange for tokens.
 * We store those tokens in the DB (gmailAccessToken & gmailRefreshToken).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }
  if (!state) {
    return NextResponse.json({ error: "Missing state" }, { status: 400 });
  }

  // 'state' is used to identify the user. For example, clerkId or user ID.
  const clerkId = state;

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT
  );

  try {
    // Exchange code for tokens
    const tokenResponse = await client.getToken(code);
    const { tokens } = tokenResponse;

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.json({ error: "Missing tokens in OAuth response" }, { status: 400 });
    }

    // Store them in DB
    await db.update(users)
      .set({
        gmailAccessToken: tokens.access_token,
        gmailRefreshToken: tokens.refresh_token
      })
      .where(eq(users.clerkId, clerkId));

    // Redirect the user to the dashboard or a success page
    const redirectUrl = new URL("/dashboard", req.url);
    return NextResponse.redirect(redirectUrl);
  } catch (err: any) {
    console.error("[Gmail OAuth] Error exchanging code for tokens:", err);
    return NextResponse.json({ error: "OAuth exchange failed" }, { status: 500 });
  }
} 