import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getThreadResponsesAction } from "@/actions/db/email-responses-actions";

/**
 * API endpoint for getting email responses for a specific thread
 * Accepts GET requests with thread ID as query parameter.
 * 
 * Query parameters:
 * - threadId: The Gmail thread ID to get responses for
 * 
 * Returns:
 * {
 *   success: boolean;
 *   responses?: Array<{
 *     id: string;
 *     messageId: string;
 *     threadId: string;
 *     from: string;
 *     to: string;
 *     subject: string;
 *     classification: string;
 *     // Other response data...
 *   }>;
 *   error?: string;
 * }
 */
export async function GET(req: NextRequest) {
  console.log("[API] Getting thread responses");
  
  try {
    // Verify the user is authenticated
    const { userId } = await getUser();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Get the thread ID from query parameters
    const searchParams = req.nextUrl.searchParams;
    const threadId = searchParams.get("threadId");
    
    if (!threadId) {
      return NextResponse.json(
        { success: false, error: "Thread ID is required" },
        { status: 400 }
      );
    }
    
    // Get responses for the thread
    const result = await getThreadResponsesAction(userId, threadId);
    
    if (!result.isSuccess) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 500 }
      );
    }
    
    // Return the responses
    return NextResponse.json({
      success: true,
      responses: result.data
    });
    
  } catch (error: any) {
    console.error("[API] Error getting thread responses:", error);
    return NextResponse.json(
      { success: false, error: error.message || "An error occurred" },
      { status: 500 }
    );
  }
} 