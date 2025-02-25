import { NextRequest, NextResponse } from "next/server";
import { getQueueMetricsAction } from "@/actions/db/email-queue-actions";
import { getUser } from "@/lib/auth";

/**
 * API endpoint for getting email queue metrics
 */
export async function GET(req: NextRequest) {
  console.log("[API] Getting email queue metrics");
  
  try {
    // Verify the user is authenticated
    const { userId } = await getUser();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Get metrics
    const result = await getQueueMetricsAction();
    
    if (!result.isSuccess) {
      console.error("[API] Error getting metrics:", result.message);
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      );
    }
    
    // Return the metrics
    return NextResponse.json({
      success: true,
      metrics: result.data
    });
    
  } catch (error: any) {
    console.error("[API] Error getting metrics:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get email queue metrics" },
      { status: 500 }
    );
  }
} 