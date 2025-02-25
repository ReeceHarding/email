"use server";

import { redirect } from "next/navigation";

/**
 * Sign-up redirect page.
 * This is used to support Clerk's default sign-up URL (/sign-up)
 * while maintaining our custom signup page (/signup).
 */
export default async function SignUpPage() {
  // Redirect to the actual signup page
  redirect("/signup");
} 