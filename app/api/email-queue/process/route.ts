import { NextRequest, NextResponse } from "next/server";
import { processQueueAction } from "@/actions/db/email-queue-actions";
import { getUser } from "@/lib/auth";

/**
 * API endpoint for processing the email queue
 * This can be called by a scheduled job or webhook
 */
export async function POST(req: NextRequest) {
  console.log("[API] Processing email queue");
  
  try {
    // Verify the user is authenticated or check API key
    const { userId } = await getUser();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Get batch size from request body if provided
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || undefined;
    
    // Process the queue
    const result = await processQueueAction(batchSize);
    
    if (!result.isSuccess) {
      console.error("[API] Error processing queue:", result.message);
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      );
    }
    
    // Return the processing results
    return NextResponse.json({
      success: true,
      processed: result.data.processed,
      successful: result.data.successful,
      failed: result.data.failed
    });
    
  } catch (error: any) {
    console.error("[API] Error processing queue:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process email queue" },
      { status: 500 }
    );
  }
} 