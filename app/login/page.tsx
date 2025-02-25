"use server";

import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default async function LoginPage({
  searchParams
}: {
  searchParams: {
    redirect_url?: string;
    error?: string;
  }
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Sign In</h1>
        
        {searchParams.error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {searchParams.error}
          </div>
        )}
        
        <Suspense fallback={<div>Loading...</div>}>
          <div className="w-full flex justify-center">
            <SignIn redirectUrl={searchParams.redirect_url || "/dashboard"} />
          </div>
        </Suspense>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Don't have an account?{" "}
            <a href="/signup" className="text-blue-600 hover:underline">
              Sign up
            </a>
          </p>
        </div>
        
        {process.env.NODE_ENV !== "production" && (
          <div className="mt-8 p-3 bg-yellow-100 text-yellow-800 rounded">
            <h2 className="font-bold mb-2">Development Mode</h2>
            <p className="mb-2">
              You can use the form above to sign in or create an account using Clerk authentication.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 