"use server";

import { ActionState } from "@/types";
import { hasGmailConnected, disconnectGmail, sendEmail } from "@/lib/gmail";
import { getUser } from "@/lib/auth";

/**
 * Checks if the current user has connected their Gmail account
 * @returns ActionState with boolean indicating connection status
 */
export async function checkGmailConnectionAction(): Promise<ActionState<boolean>> {
  console.log("[checkGmailConnectionAction] Checking Gmail connection...");
  
  try {
    const { userId } = await getUser();
    if (!userId) {
      console.log("[checkGmailConnectionAction] No authenticated user");
      return {
        isSuccess: false,
        message: "No authenticated user"
      };
    }
    
    const isConnected = await hasGmailConnected(userId);
    return {
      isSuccess: true,
      message: "Gmail connection checked successfully",
      data: isConnected
    };
  } catch (error) {
    console.error("[checkGmailConnectionAction] Error:", error);
    return {
      isSuccess: false,
      message: "Failed to check Gmail connection"
    };
  }
}

/**
 * Disconnects the current user's Gmail account
 * @returns ActionState with boolean indicating success
 */
export async function disconnectGmailAction(): Promise<ActionState<boolean>> {
  console.log("[disconnectGmailAction] Disconnecting Gmail...");
  
  try {
    const { userId } = await getUser();
    if (!userId) {
      console.log("[disconnectGmailAction] No authenticated user");
      return {
        isSuccess: false,
        message: "No authenticated user"
      };
    }
    
    const success = await disconnectGmail(userId);
    return {
      isSuccess: true,
      message: success ? "Gmail disconnected successfully" : "Failed to disconnect Gmail",
      data: success
    };
  } catch (error) {
    console.error("[disconnectGmailAction] Error:", error);
    return {
      isSuccess: false,
      message: "Error disconnecting Gmail"
    };
  }
}

/**
 * Sends an email using the current user's Gmail account
 * @param options - Email options including recipient, subject, and body
 * @returns ActionState with thread and message IDs
 */
export async function sendEmailAction({
  to,
  subject,
  body,
  cc,
  bcc
}: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}): Promise<ActionState<{ threadId: string; messageId: string }>> {
  console.log("[sendEmailAction] Sending email to:", to);
  
  try {
    const { userId } = await getUser();
    if (!userId) {
      console.log("[sendEmailAction] No authenticated user");
      return {
        isSuccess: false,
        message: "No authenticated user"
      };
    }
    
    // Verify Gmail is connected
    const isConnected = await hasGmailConnected(userId);
    if (!isConnected) {
      console.log("[sendEmailAction] Gmail not connected");
      return {
        isSuccess: false,
        message: "Gmail account not connected"
      };
    }
    
    // Send the email
    const result = await sendEmail({
      userId,
      to,
      subject,
      body,
      cc,
      bcc
    });
    
    return {
      isSuccess: true,
      message: "Email sent successfully",
      data: result
    };
  } catch (error) {
    console.error("[sendEmailAction] Error:", error);
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to send email"
    };
  }
} 