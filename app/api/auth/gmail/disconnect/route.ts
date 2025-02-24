import { NextResponse } from "next/server";
import { disconnectGmailAction } from "@/actions/gmail-actions";

export async function POST() {
  try {
    console.log("[Gmail Disconnect API] Disconnecting Gmail");
    
    const result = await disconnectGmailAction();
    
    if (!result.isSuccess) {
      return NextResponse.json(result, { status: 400 });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Gmail Disconnect API] Error:", error);
    return NextResponse.json(
      { 
        isSuccess: false, 
        message: "Failed to disconnect Gmail",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 