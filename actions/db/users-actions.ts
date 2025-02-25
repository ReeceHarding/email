"use server"

import { db } from "@/db/db"
import { usersTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { ActionState } from "@/types"

export async function checkGmailConnectionAction(
  userClerkId: string
): Promise<ActionState<boolean>> {
  console.log("[checkGmailConnectionAction] Called with clerkId:", userClerkId)
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.userId, userClerkId))
      .limit(1)

    console.log("[checkGmailConnectionAction] Drizzle query returned user:", user)

    if (!user) {
      console.log("[checkGmailConnectionAction] No user found, returning false")
      return {
        isSuccess: true,
        message: "User not found",
        data: false
      }
    }

    const hasTokens = !!user.gmailAccessToken
    console.log("[checkGmailConnectionAction] Found tokens?:", hasTokens)
    return {
      isSuccess: true,
      message: "Gmail connection checked successfully",
      data: hasTokens
    }
  } catch (err) {
    console.error("[checkGmailConnectionAction] Error checking Gmail connection:", err)
    return {
      isSuccess: false,
      message: "Failed to check Gmail connection"
    }
  }
} 