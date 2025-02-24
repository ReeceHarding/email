import "dotenv/config";
import axios from "axios";
import { GeneratedEmail } from "./content-generation";
import { db } from "@/db/db";
import { auth } from "@clerk/nextjs/server";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

interface SendEmailOptions {
  userId: string;
  to: string;
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
}

interface SendMultipleEmailsOptions {
  userId: string;
  emails: Array<{
    to: string;
    subject: string;
    body: string;
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
  }>;
  delayBetweenEmailsMs?: number;
}

interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Check if the user has connected their Gmail account
 */
export async function isGmailConnected(userId: string): Promise<boolean> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(usersTable.userId, userId),
      columns: {
        gmailAccessToken: true,
        gmailRefreshToken: true
      }
    });

    return !!(user?.gmailAccessToken && user?.gmailRefreshToken);
  } catch (error) {
    console.error("[EmailService] Error checking Gmail connection:", error);
    return false;
  }
}

/**
 * Send a single email using the Gmail API
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
  try {
    console.log(`[EmailService] Sending email to ${options.to} with subject: ${options.subject}`);
    
    // Check if Gmail is connected
    const isConnected = await isGmailConnected(options.userId);
    if (!isConnected) {
      return {
        success: false,
        error: "Gmail is not connected. Please connect your Gmail account first."
      };
    }
    
    // Make API call to internal Gmail send endpoint
    const response = await axios.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/email-gmail/send`, {
      to: options.to,
      subject: options.subject,
      body: options.body,
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo,
      userId: options.userId
    });
    
    if (response.status !== 200) {
      throw new Error(`Failed to send email: ${response.data.error || 'Unknown error'}`);
    }
    
    return {
      success: true,
      messageId: response.data.messageId
    };
  } catch (error: any) {
    console.error("[EmailService] Error sending email:", error);
    return {
      success: false,
      error: error.message || "Failed to send email"
    };
  }
}

/**
 * Send multiple emails with a delay between each
 */
export async function sendMultipleEmails(
  options: SendMultipleEmailsOptions
): Promise<EmailSendResult[]> {
  const results: EmailSendResult[] = [];
  const delay = options.delayBetweenEmailsMs || 1000; // Default 1 second delay
  
  console.log(`[EmailService] Sending ${options.emails.length} emails with ${delay}ms delay between each`);
  
  for (const email of options.emails) {
    // Send the email
    const result = await sendEmail({
      userId: options.userId,
      to: email.to,
      subject: email.subject,
      body: email.body,
      cc: email.cc,
      bcc: email.bcc,
      replyTo: email.replyTo
    });
    
    results.push(result);
    
    // If not the last email, add delay
    if (email !== options.emails[options.emails.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return results;
}

/**
 * Send a generated email to a recipient
 */
export async function sendGeneratedEmail(
  userId: string,
  email: GeneratedEmail,
  options?: {
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
  }
): Promise<EmailSendResult> {
  if (!email.recipientEmail) {
    return {
      success: false,
      error: "Recipient email is missing"
    };
  }
  
  return sendEmail({
    userId,
    to: email.recipientEmail,
    subject: email.subject,
    body: email.body,
    cc: options?.cc,
    bcc: options?.bcc,
    replyTo: options?.replyTo
  });
}

/**
 * Get the connection status with detailed information
 */
export async function getGmailConnectionStatus(userId: string): Promise<{
  connected: boolean;
  email?: string;
  lastChecked: Date;
  scopes?: string[];
  error?: string;
}> {
  try {
    // Make API call to internal Gmail status endpoint
    const response = await axios.get(`${process.env.NEXT_PUBLIC_APP_URL}/api/email-gmail/status`, {
      params: { userId }
    });
    
    if (response.status !== 200) {
      throw new Error(response.data.error || 'Failed to get Gmail connection status');
    }
    
    return {
      connected: response.data.connected,
      email: response.data.email,
      lastChecked: new Date(),
      scopes: response.data.scopes,
      error: response.data.error
    };
  } catch (error: any) {
    console.error("[EmailService] Error getting Gmail connection status:", error);
    return {
      connected: false,
      lastChecked: new Date(),
      error: error.message || "Failed to get Gmail connection status"
    };
  }
}

/**
 * Disconnect Gmail by revoking access tokens
 */
export async function disconnectGmail(userId: string): Promise<boolean> {
  try {
    // Make API call to internal Gmail disconnect endpoint
    const response = await axios.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/email-gmail/disconnect`, {
      userId
    });
    
    if (response.status !== 200) {
      throw new Error(response.data.error || 'Failed to disconnect Gmail');
    }
    
    return true;
  } catch (error: any) {
    console.error("[EmailService] Error disconnecting Gmail:", error);
    return false;
  }
} 