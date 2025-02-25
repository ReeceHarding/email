"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallbackUrl?: string;
}

/**
 * Protected route component.
 * Ensures users are authenticated before rendering children.
 * Redirects to the fallback URL if user is not signed in.
 */
export function ProtectedRoute({ 
  children, 
  fallbackUrl = "/login" 
}: ProtectedRouteProps) {
  const { isLoaded, userId } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (isLoaded && !userId) {
      router.push(fallbackUrl);
    }
  }, [isLoaded, userId, router, fallbackUrl]);
  
  if (!isLoaded) {
    return <div className="p-8 flex justify-center">Loading...</div>;
  }
  
  if (!userId) {
    return null; // Will redirect from the useEffect
  }
  
  return <>{children}</>;
} 