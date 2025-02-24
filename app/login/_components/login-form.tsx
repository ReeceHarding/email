"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAction, loginAsTestUserAction } from "@/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginForm({ redirectPath = "/dashboard" }: { redirectPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    try {
      if (!email || !email.includes("@")) {
        setError("Please enter a valid email address");
        return;
      }
      
      const result = await loginAction(email);
      
      if (result.isSuccess) {
        router.push(redirectPath);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleTestUserLogin = async () => {
    setError("");
    setIsLoading(true);
    
    try {
      const result = await loginAsTestUserAction();
      
      if (result.isSuccess) {
        router.push(redirectPath);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email Address
        </label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          disabled={isLoading}
          className="w-full"
        />
      </div>
      
      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}
      
      <div className="flex flex-col space-y-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign In"}
        </Button>
        
        {process.env.NODE_ENV !== "production" && (
          <Button
            type="button"
            variant="outline"
            onClick={handleTestUserLogin}
            disabled={isLoading}
          >
            Login as Test User
          </Button>
        )}
      </div>
      
      <p className="text-sm text-gray-500 mt-4">
        For this demo, we're using a passwordless login.
        In production, you would want to implement proper authentication.
      </p>
    </form>
  );
} 