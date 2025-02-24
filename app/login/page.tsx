"use server";

import { createTestUser } from "@/lib/auth";
import LoginForm from "./_components/login-form";
import { Suspense } from "react";

export default async function LoginPage({
  searchParams
}: {
  searchParams: {
    redirect?: string;
    error?: string;
  }
}) {
  // For development: Create a test user automatically
  if (process.env.NODE_ENV !== "production") {
    await createTestUser();
  }
  
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
          <LoginForm redirectPath={searchParams.redirect} />
        </Suspense>
        
        {process.env.NODE_ENV !== "production" && (
          <div className="mt-8 p-3 bg-yellow-100 text-yellow-800 rounded">
            <h2 className="font-bold mb-2">Development Mode</h2>
            <p className="mb-2">
              A test user has been automatically created:
            </p>
            <ul className="list-disc pl-5">
              <li>Email: test@example.com</li>
              <li>User ID: test_user_123</li>
            </ul>
            <p className="mt-2 text-sm">
              You can click "Login as Test User" to sign in with this account.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 