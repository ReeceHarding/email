import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { google } from "googleapis";

/**
 * Callback route for Google OAuth.
 * We'll parse the 'code' and 'state' from query params, then exchange for tokens.
 * We store those tokens in the DB (gmailAccessToken & gmailRefreshToken).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // Redirect to the proper Gmail OAuth callback endpoint
  const redirectUrl = new URL("/api/auth/gmail", url.origin);
  // Preserve all query parameters
  url.searchParams.forEach((value, key) => {
    redirectUrl.searchParams.append(key, value);
  });
  return NextResponse.redirect(redirectUrl);
} 