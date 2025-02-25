import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get the current user from Clerk and synchronize with our database
 */
export async function getCurrentUser() {
  try {
    // Get the user from Clerk
    const clerkUser = await currentUser();
    
    if (!clerkUser) {
      return null;
    }
    
    // Check if the user exists in our database
    const existingUser = await db.query.users.findFirst({
      where: eq(usersTable.userId, clerkUser.id)
    });
    
    if (existingUser) {
      // Update the user data if needed
      if (
        existingUser.name !== clerkUser.firstName ||
        existingUser.email !== clerkUser.emailAddresses[0]?.emailAddress
      ) {
        await db.update(usersTable)
          .set({
            name: clerkUser.firstName || existingUser.name,
            email: clerkUser.emailAddresses[0]?.emailAddress || existingUser.email,
            updatedAt: new Date()
          })
          .where(eq(usersTable.userId, clerkUser.id));
      }
    } else {
      // Create a new user record in our database
      await db.insert(usersTable)
        .values({
          userId: clerkUser.id,
          name: clerkUser.firstName || 'User',
          email: clerkUser.emailAddresses[0]?.emailAddress || '',
          createdAt: new Date(),
          updatedAt: new Date()
        });
    }
    
    return clerkUser;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

/**
 * Get the current authentication state
 */
export async function getAuth() {
  return await auth();
}

/**
 * Get user ID from the current session
 */
export async function getUserId() {
  const { userId } = await auth();
  return userId;
}

/**
 * Check if the user is authenticated
 */
export async function isAuthenticated() {
  const { userId } = await auth();
  return !!userId;
} 