"use server";

import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export default async function SignUpPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Create Account</h1>
        
        <Suspense fallback={<div>Loading...</div>}>
          <div className="w-full flex justify-center">
            <SignUp />
          </div>
        </Suspense>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Already have an account?{" "}
            <a href="/login" className="text-blue-600 hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
} 