import { NextRequest, NextResponse } from "next/server";
import { sendEmailAction } from "@/actions/gmail-actions";

export async function POST(req: NextRequest) {
  try {
    console.log("[Gmail Send API] Sending email");
    
    // Parse request body
    const body = await req.json();
    const { to, subject, body: emailBody, cc, bcc } = body;
    
    // Validate required fields
    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { 
          isSuccess: false, 
          message: "Missing required fields (to, subject, body)"
        },
        { status: 400 }
      );
    }
    
    // Send email
    const result = await sendEmailAction({
      to,
      subject,
      body: emailBody,
      cc,
      bcc
    });
    
    if (!result.isSuccess) {
      return NextResponse.json(result, { status: 400 });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Gmail Send API] Error:", error);
    return NextResponse.json(
      { 
        isSuccess: false, 
        message: "Failed to send email",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 