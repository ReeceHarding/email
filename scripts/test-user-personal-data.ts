/**
 * @file test-user-personal-data.ts
 * @description Test script to validate the user_personal_data schema and CRUD operations
 */

import { db, pool } from "@/db/db";
import { userPersonalDataTable } from "@/db/schema/user-personal-data-schema";
import { eq } from "drizzle-orm";

async function main() {
  try {
    console.log("🔍 Testing user_personal_data schema...");

    // Test 1: Insert a new record
    console.log("\n📝 Test 1: Inserting new user personal data...");
    const [newUser] = await db.insert(userPersonalDataTable).values({
      userId: "test_user_123",
      education: "University of Wisconsin",
      hobbies: "coding, fishing, hiking",
      location: "Madison, WI",
      notes: "Test notes for the user"
    }).returning();
    
    console.log("✅ Insert successful:", newUser);

    // Test 2: Read the record
    console.log("\n📖 Test 2: Reading user personal data...");
    const readUser = await db.query.userPersonalData.findFirst({
      where: eq(userPersonalDataTable.id, newUser.id)
    });
    
    console.log("✅ Read successful:", readUser);

    // Test 3: Update the record
    console.log("\n📝 Test 3: Updating user personal data...");
    const [updatedUser] = await db.update(userPersonalDataTable)
      .set({ 
        hobbies: "coding, fishing, hiking, photography",
        notes: "Updated test notes"
      })
      .where(eq(userPersonalDataTable.id, newUser.id))
      .returning();
    
    console.log("✅ Update successful:", updatedUser);

    // Test 4: Delete the record
    console.log("\n🗑️ Test 4: Deleting user personal data...");
    const [deletedUser] = await db.delete(userPersonalDataTable)
      .where(eq(userPersonalDataTable.id, newUser.id))
      .returning();
    
    console.log("✅ Delete successful:", deletedUser);

    console.log("\n✨ All tests completed successfully!");
  } catch (error) {
    console.error("❌ Error during testing:", error);
    process.exit(1);
  } finally {
    // Close the database connection pool
    await pool.end();
  }
}

// Run the tests
main(); 