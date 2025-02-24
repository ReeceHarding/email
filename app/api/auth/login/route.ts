import { NextRequest, NextResponse } from "next/server";
import { createUserSession, createTestUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    console.log("[Auth API] Login request received");
    
    // For development purposes, always create/use the test user
    const testUser = await createTestUser();
    
    // Create a session for the test user
    const result = await createUserSession(testUser.userId, testUser.email);
    
    if (!result.success) {
      console.error("[Auth API] Failed to create session");
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }
    
    console.log("[Auth API] Test user logged in successfully");
    return NextResponse.json(
      { success: true, message: "Logged in as test user" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Auth API] Login error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
} 