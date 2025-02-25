/**
 * Email Response Handler
 * 
 * This service handles the detection, classification, and management of email responses.
 * It provides functionality to:
 * - Process incoming emails from Gmail webhooks
 * - Classify responses using AI (positive, negative, question, etc.)
 * - Track email threads and conversations
 * - Generate notifications for important responses
 */

import { db } from "@/db/db";
import { google } from "googleapis";
import { getGmailClient } from "@/lib/gmail";
import { OpenAI } from "openai";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ActionState } from "@/types";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Response classification categories
 */
export enum ResponseClassification {
  POSITIVE = "positive",        // Interested, want to learn more
  NEGATIVE = "negative",        // Not interested, do not contact
  QUESTION = "question",        // Has questions needing answers
  MEETING_REQUEST = "meeting",  // Wants to schedule a meeting
  REFERRAL = "referral",        // Referring to someone else
  OUT_OF_OFFICE = "out_of_office", // Out of office reply
  OTHER = "other"               // Other type of response
}

/**
 * Email response data structure
 */
export interface EmailResponse {
  messageId: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  receivedAt: Date;
  classification?: ResponseClassification;
  confidence?: number;
  keyPoints?: string[];
  originalEmailId?: string;
  userId: string;
}

/**
 * Process a new email received via Gmail webhook
 */
export async function processIncomingEmail(
  userId: string,
  historyId: string
): Promise<ActionState<EmailResponse[]>> {
  console.log(`[Email Response] Processing incoming email for user ${userId} with history ID ${historyId}`);
  
  try {
    // Get Gmail client for the user
    const gmail = await getGmailClient(userId);
    
    // Get history details
    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: historyId,
      historyTypes: ['messageAdded']
    });
    
    const history = historyResponse.data.history || [];
    const processedResponses: EmailResponse[] = [];
    
    // Process each message in the history
    for (const record of history) {
      const messagesAdded = record.messagesAdded || [];
      
      for (const messageAdded of messagesAdded) {
        if (!messageAdded.message?.id) continue;
        
        const messageId = messageAdded.message.id;
        
        // Get the full message
        const messageResponse = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full'
        });
        
        const message = messageResponse.data;
        
        // Check if this is an incoming email (not sent by the user)
        if (!isIncomingEmail(message, userId)) {
          console.log(`[Email Response] Skipping message ${messageId} - not an incoming email`);
          continue;
        }
        
        // Extract email details
        const email = extractEmailDetails(message);
        
        if (!email) {
          console.log(`[Email Response] Could not extract details from message ${messageId}`);
          continue;
        }
        
        // Find original email this is responding to
        const originalEmailId = await findOriginalEmailId(message.threadId || '', userId);
        
        // Create email response object
        const emailResponse: EmailResponse = {
          messageId: messageId,
          threadId: message.threadId || '',
          from: email.from,
          to: email.to,
          subject: email.subject,
          body: email.body,
          receivedAt: new Date(),
          originalEmailId,
          userId
        };
        
        // Classify the response
        const classificationResult = await classifyEmailResponse(emailResponse);
        emailResponse.classification = classificationResult.classification;
        emailResponse.confidence = classificationResult.confidence;
        emailResponse.keyPoints = classificationResult.keyPoints;
        
        // Store the response in the database (would be implemented in the schema)
        // await storeEmailResponse(emailResponse);
        
        // Add to processed responses
        processedResponses.push(emailResponse);
        
        // Create notification (this would be implemented as a separate service)
        // await createNotification(userId, emailResponse);
      }
    }
    
    return {
      isSuccess: true,
      message: `Processed ${processedResponses.length} email responses`,
      data: processedResponses
    };
    
  } catch (error: any) {
    console.error("[Email Response] Error processing incoming email:", error);
    return {
      isSuccess: false,
      message: `Failed to process email response: ${error.message}`
    };
  }
}

/**
 * Check if an email is incoming (not sent by the user)
 */
function isIncomingEmail(message: any, userId: string): boolean {
  const headers = message.payload?.headers || [];
  const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from');
  const toHeader = headers.find((h: any) => h.name.toLowerCase() === 'to');
  
  if (!fromHeader || !toHeader) return false;
  
  // This is a simplification - in a real implementation, you would check
  // if the 'to' address belongs to the user and the 'from' address doesn't
  return true;
}

/**
 * Extract email details from a Gmail message
 */
function extractEmailDetails(message: any): { from: string; to: string; subject: string; body: string } | null {
  try {
    const headers = message.payload?.headers || [];
    const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from');
    const toHeader = headers.find((h: any) => h.name.toLowerCase() === 'to');
    const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject');
    
    if (!fromHeader || !toHeader || !subjectHeader) {
      return null;
    }
    
    // Extract body - this is simplified and would need to handle
    // different MIME types and multipart messages
    let body = '';
    
    if (message.payload?.body?.data) {
      // Decode base64url encoded body
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf8');
    } else if (message.payload?.parts) {
      // Try to find text part
      const textPart = message.payload.parts.find(
        (part: any) => part.mimeType === 'text/plain' || part.mimeType === 'text/html'
      );
      
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf8');
      }
    }
    
    return {
      from: fromHeader.value,
      to: toHeader.value,
      subject: subjectHeader.value,
      body
    };
  } catch (error) {
    console.error("[Email Response] Error extracting email details:", error);
    return null;
  }
}

/**
 * Find the original email ID that this response is replying to
 */
async function findOriginalEmailId(threadId: string, userId: string): Promise<string | undefined> {
  try {
    // Get Gmail client
    const gmail = await getGmailClient(userId);
    
    // Get all messages in thread
    const threadResponse = await gmail.users.threads.get({
      userId: 'me',
      id: threadId
    });
    
    const messages = threadResponse.data.messages || [];
    
    // The first message in the thread should be the original email
    if (messages.length > 0 && messages[0].id) {
      return messages[0].id;
    }
    
    return undefined;
  } catch (error) {
    console.error("[Email Response] Error finding original email:", error);
    return undefined;
  }
}

/**
 * Classify an email response using AI
 */
async function classifyEmailResponse(
  email: EmailResponse
): Promise<{
  classification: ResponseClassification;
  confidence: number;
  keyPoints: string[];
}> {
  try {
    // Use OpenAI to classify the email
    const prompt = `
      Analyze the following email response and classify it into one of these categories:
      - positive: Interested, wants to learn more
      - negative: Not interested, do not contact
      - question: Has questions needing answers
      - meeting: Wants to schedule a meeting
      - referral: Referring to someone else
      - out_of_office: Out of office auto-reply
      - other: Other type of response
      
      Also extract 1-3 key points from the email.
      
      Email subject: ${email.subject}
      Email body:
      ${email.body}
      
      Respond with a JSON object with the following structure:
      {
        "classification": "the_category",
        "confidence": 0.95,
        "keyPoints": ["point 1", "point 2", "point 3"]
      }
      `;
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You analyze email responses to cold outreach emails and classify them accurately." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500
    });
    
    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error("No response from AI classification");
    }
    
    // Parse JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from AI response");
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    return {
      classification: result.classification as ResponseClassification,
      confidence: result.confidence,
      keyPoints: result.keyPoints
    };
  } catch (error: any) {
    console.error("[Email Response] Error classifying email with AI:", error);
    
    // Return a default classification if AI fails
    return {
      classification: ResponseClassification.OTHER,
      confidence: 0,
      keyPoints: ["AI classification failed"]
    };
  }
}

/**
 * Get all responses for a specific email thread
 */
export async function getThreadResponses(
  userId: string,
  threadId: string
): Promise<ActionState<EmailResponse[]>> {
  try {
    // This would fetch responses from the database
    // For now, we'll just return a mock response
    return {
      isSuccess: true,
      message: "Thread responses retrieved successfully",
      data: []
    };
  } catch (error: any) {
    return {
      isSuccess: false,
      message: `Failed to get thread responses: ${error.message}`
    };
  }
}

/**
 * Get a summary of recent responses
 */
export async function getResponsesSummary(
  userId: string,
  days: number = 7
): Promise<ActionState<{
  total: number;
  positive: number;
  negative: number;
  questions: number;
  meetingRequests: number;
  unread: number;
}>> {
  try {
    // This would fetch and summarize responses from the database
    // For now, we'll just return a mock response
    return {
      isSuccess: true,
      message: "Response summary generated successfully",
      data: {
        total: 0,
        positive: 0,
        negative: 0,
        questions: 0,
        meetingRequests: 0,
        unread: 0
      }
    };
  } catch (error: any) {
    return {
      isSuccess: false,
      message: `Failed to generate response summary: ${error.message}`
    };
  }
} 