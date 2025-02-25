"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { UserButton } from "./user-button";

/**
 * Authentication status component.
 * Displays login button when signed out or user button when signed in.
 */
export function AuthStatus() {
  return (
    <div className="flex items-center gap-4">
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
      
      <SignedOut>
        <SignInButton mode="modal">
          <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            Sign In
          </button>
        </SignInButton>
      </SignedOut>
    </div>
  );
} 