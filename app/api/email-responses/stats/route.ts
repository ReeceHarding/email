import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getResponseStatsAction } from "@/actions/db/email-responses-actions";

/**
 * API endpoint for getting email response statistics
 * Accepts GET requests and returns statistics about email responses.
 * 
 * Query parameters:
 * - startDate (optional): The start date for the stats (YYYY-MM-DD)
 * - endDate (optional): The end date for the stats (YYYY-MM-DD)
 * 
 * Returns:
 * {
 *   success: boolean;
 *   stats?: {
 *     total: number;
 *     byClassification: Record<string, number>;
 *     unread: number;
 *     needsFollowUp: number;
 *   };
 *   error?: string;
 * }
 */
export async function GET(req: NextRequest) {
  console.log("[API] Getting email response statistics");
  
  try {
    // Verify the user is authenticated
    const { userId } = await getUser();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    
    // Parse dates if provided
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;
    
    // Get response statistics
    const result = await getResponseStatsAction(userId, startDate, endDate);
    
    if (!result.isSuccess) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 500 }
      );
    }
    
    // Return the statistics
    return NextResponse.json({
      success: true,
      stats: result.data
    });
    
  } catch (error: any) {
    console.error("[API] Error getting email response statistics:", error);
    return NextResponse.json(
      { success: false, error: error.message || "An error occurred" },
      { status: 500 }
    );
  }
} 