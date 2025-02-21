"use client"

import { SignInButton, SignOutButton, useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"

export default function Header() {
  const { user, isLoaded } = useUser()

  return (
    <header className="w-full border-b">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Gmail App</h1>
        </div>

        <div className="flex items-center gap-4">
          {!isLoaded ? (
            <Button variant="outline" disabled>
              Loading...
            </Button>
          ) : user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user.emailAddresses[0]?.emailAddress}
              </span>
              <SignOutButton>
                <Button variant="outline">Sign Out</Button>
              </SignOutButton>
            </div>
          ) : (
            <SignInButton mode="modal">
              <Button>
                Sign In with Google
              </Button>
            </SignInButton>
          )}
        </div>
      </div>
    </header>
  )
} 