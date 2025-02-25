import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const SESSION_COOKIE_NAME = "app_session";
const SESSION_DURATION_DAYS = 30;

/**
 * Get the current authenticated user from the session
 */
export async function getUser() {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    
    if (!sessionToken) {
      console.log("[Auth] No session token found");
      return { userId: null };
    }
    
    const user = await db.query.users.findFirst({
      where: eq(usersTable.sessionToken, sessionToken)
    });
    
    if (!user) {
      console.log("[Auth] No user found for session token");
      return { userId: null };
    }
    
    return { userId: user.userId };
  } catch (error) {
    console.error("[Auth] Error getting user:", error);
    return { userId: null };
  }
}

/**
 * Create a session for a user and set a cookie
 */
export async function createUserSession(userId: string, email: string) {
  try {
    // Generate a unique session token
    const sessionToken = uuidv4();
    
    // Find existing user or create a new one
    const existingUser = await db.query.users.findFirst({
      where: eq(usersTable.email, email)
    });
    
    if (existingUser) {
      // Update the existing user with the new session token
      await db.update(usersTable)
        .set({ 
          sessionToken,
          updatedAt: new Date()
        })
        .where(eq(usersTable.userId, existingUser.userId));
    } else {
      // Create a new user with auto-generated ID
      const username = email.split('@')[0];
      await db.insert(usersTable)
        .values({
          userId,
          name: username,
          email,
          sessionToken
        });
    }
    
    // Set the session cookie
    const cookieStore = cookies();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + SESSION_DURATION_DAYS);
    
    cookieStore.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      expires: expiryDate,
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    });
    
    return { success: true };
  } catch (error) {
    console.error("[Auth] Error creating session:", error);
    return { success: false };
  }
}

/**
 * Sign out the current user by removing the session token
 */
export async function signOutUser() {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    
    if (sessionToken) {
      // Update the user record to clear the session token
      await db.update(usersTable)
        .set({ sessionToken: null })
        .where(eq(usersTable.sessionToken, sessionToken));
      
      // Delete the cookie
      cookieStore.delete(SESSION_COOKIE_NAME);
    }
    
    return { success: true };
  } catch (error) {
    console.error("[Auth] Error signing out:", error);
    return { success: false };
  }
}

/**
 * Middleware function to check if a request is authenticated
 */
export async function requireAuth(request: NextRequest) {
  const { userId } = await getUser();
  
  if (!userId) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }
  
  return null; // Continue with the request
}

/**
 * Create a test user for development
 */
export async function createTestUser() {
  try {
    const testUser = {
      userId: "test_user_123",
      email: "test@example.com",
      name: "Test User"
    };
    
    const existingUser = await db.query.users.findFirst({
      where: eq(usersTable.userId, testUser.userId)
    });
    
    if (!existingUser) {
      await db.insert(usersTable).values(testUser);
      console.log("[Auth] Created test user:", testUser.userId);
    } else {
      console.log("[Auth] Test user already exists:", testUser.userId);
    }
    
    return testUser;
  } catch (error) {
    console.error("[Auth] Error creating test user:", error);
    throw error;
  }
} 