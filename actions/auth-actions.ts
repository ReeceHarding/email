"use server";

import { ActionState } from "@/types";
import { createUserSession } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

/**
 * Login action - creates a new user or logs in an existing one
 * For simplicity, we're using passwordless login
 */
export async function loginAction(email: string): Promise<ActionState<void>> {
  try {
    if (!email || !email.includes("@")) {
      return {
        isSuccess: false,
        message: "Invalid email address"
      };
    }
    
    // Generate a user ID if this is a new user
    const userId = uuidv4();
    
    // Create a session for the user
    const result = await createUserSession(userId, email);
    
    if (result.success) {
      return {
        isSuccess: true,
        message: "Login successful",
        data: undefined
      };
    } else {
      return {
        isSuccess: false,
        message: "Login failed"
      };
    }
  } catch (error) {
    console.error("Login error:", error);
    return {
      isSuccess: false,
      message: "An unexpected error occurred"
    };
  }
}

/**
 * Login as test user action - specially for development
 */
export async function loginAsTestUserAction(): Promise<ActionState<void>> {
  try {
    if (process.env.NODE_ENV === "production") {
      return {
        isSuccess: false,
        message: "Test user login is not available in production"
      };
    }
    
    // Use the test user credentials
    const result = await createUserSession(
      "test_user_123",
      "test@example.com"
    );
    
    if (result.success) {
      return {
        isSuccess: true,
        message: "Test user login successful",
        data: undefined
      };
    } else {
      return {
        isSuccess: false,
        message: "Test user login failed"
      };
    }
  } catch (error) {
    console.error("Test user login error:", error);
    return {
      isSuccess: false,
      message: "An unexpected error occurred"
    };
  }
} 