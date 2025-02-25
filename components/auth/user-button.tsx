"use client";

import { UserButton as ClerkUserButton } from "@clerk/nextjs";

interface UserButtonProps {
  afterSignOutUrl?: string;
}

/**
 * User account button component.
 * Displays user avatar and provides access to account management.
 */
export function UserButton({ afterSignOutUrl = "/" }: UserButtonProps) {
  return (
    <ClerkUserButton
      afterSignOutUrl={afterSignOutUrl}
      appearance={{
        elements: {
          userButtonAvatarBox: "w-10 h-10",
        }
      }}
    />
  );
} 