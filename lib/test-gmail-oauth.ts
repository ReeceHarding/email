import { db } from "@/db/db"
import { usersTable } from "@/db/schema"
import { eq } from "drizzle-orm"

const TEST_USER = {
  clerkId: "test_user_123",
  email: "test@example.com"
}

export async function setupTestUser() {
  try {
    // Delete existing test user if any
    await db.delete(usersTable)
      .where(eq(usersTable.clerkId, TEST_USER.clerkId))

    // Create new test user
    const [user] = await db.insert(usersTable)
      .values(TEST_USER)
      .returning()

    console.log("Test user created:", user)
    return user
  } catch (error) {
    console.error("Error setting up test user:", error)
    throw error
  }
}

export async function cleanupTestUser() {
  try {
    await db.delete(usersTable)
      .where(eq(usersTable.clerkId, TEST_USER.clerkId))
    console.log("Test user cleaned up")
  } catch (error) {
    console.error("Error cleaning up test user:", error)
    throw error
  }
}

if (require.main === module) {
  setupTestUser()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Test setup failed:", error)
      process.exit(1)
    })
} 