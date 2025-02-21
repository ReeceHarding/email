"use client"

import { SignIn } from "@clerk/nextjs"

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-white shadow-none",
            formButtonPrimary: "bg-black hover:bg-gray-800"
          }
        }}
      />
    </div>
  )
} 