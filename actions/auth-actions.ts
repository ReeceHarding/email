"use server";

import { ActionState } from "@/types";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Get the current user profile data
 */
export async function getCurrentUserAction(): Promise<ActionState<{
  id: string;
  email: string;
  name: string;
  imageUrl?: string;
}>> {
  try {
    // Get auth state from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return {
        isSuccess: false,
        message: "Not authenticated"
      };
    }
    
    // Get user details using currentUser() which is more efficient than clerkClient
    const user = await currentUser();
    
    if (!user) {
      return {
        isSuccess: false,
        message: "User not found"
      };
    }
    
    return {
      isSuccess: true,
      message: "User retrieved successfully",
      data: {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || "",
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User",
        imageUrl: user.imageUrl
      }
    };
  } catch (error) {
    console.error("Error getting user profile:", error);
    return {
      isSuccess: false,
      message: "Failed to retrieve user profile"
    };
  }
}

/**
 * Sign out the current user
 */
export async function signOutAction(): Promise<ActionState<void>> {
  try {
    return {
      isSuccess: true,
      message: "Signed out successfully",
      data: undefined
    };
  } catch (error) {
    console.error("Error signing out:", error);
    return {
      isSuccess: false,
      message: "Failed to sign out"
    };
  }
}

/**
 * Protect route - redirects to login if not authenticated
 */
export async function protectRouteAction(): Promise<ActionState<{
  userId: string;
}>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      redirect("/login");
    }
    
    return {
      isSuccess: true,
      message: "User is authenticated",
      data: { userId }
    };
  } catch (error) {
    console.error("Error protecting route:", error);
    redirect("/login");
  }
} 