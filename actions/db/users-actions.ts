"use server"

import { db } from "@/db/db"
import { usersTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { ActionState } from "@/types"

export async function checkGmailConnectionAction(
  userClerkId: string
): Promise<ActionState<boolean>> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(usersTable.clerkId, userClerkId)
    })
    return {
      isSuccess: true,
      message: "Gmail connection checked successfully",
      data: !!user?.gmailAccessToken
    }
  } catch (err) {
    console.error("Error checking Gmail connection:", err)
    return {
      isSuccess: false,
      message: "Failed to check Gmail connection"
    }
  }
} 