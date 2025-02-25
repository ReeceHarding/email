"use server";

import { redirect } from "next/navigation";

/**
 * Sign-in redirect page.
 * This is used to support Clerk's default sign-in URL (/sign-in)
 * while maintaining our custom login page (/login).
 */
export default async function SignInPage() {
  // Redirect to the actual login page
  redirect("/login");
} 