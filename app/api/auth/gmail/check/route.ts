import { NextResponse } from "next/server";
import { checkGmailConnectionAction } from "@/actions/gmail-actions";

export async function GET() {
  try {
    console.log("[Gmail Check API] Checking Gmail connection");
    
    const result = await checkGmailConnectionAction();
    
    if (!result.isSuccess) {
      return NextResponse.json(result, { status: 400 });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Gmail Check API] Error:", error);
    return NextResponse.json(
      { 
        isSuccess: false, 
        message: "Failed to check Gmail connection",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 