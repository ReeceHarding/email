import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

/**
 * Stripe webhook route to handle subscription events like invoice.payment_succeeded.
 * Set your Stripe Dashboard "Webhook URL" to e.g. https://yourapp.com/api/stripe-webhook
 * And place the SIGNING SECRET in process.env.STRIPE_WEBHOOK_SECRET.
 *
 * Note that Next 13 doesn't automatically provide raw body, so we parse manually.
 */
export const config = {
  // We must disable Next.js built-in body parsing so we can validate the Stripe signature.
  api: {
    bodyParser: false
  }
};

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing Stripe signature header", { status: 400 });
  }

  let event;
  let bodyBuffer: Buffer;
  try {
    // Get raw body from request
    const arrayBuffer = await req.arrayBuffer();
    bodyBuffer = Buffer.from(arrayBuffer);
  } catch (e) {
    console.error("[Stripe Webhook] Error reading raw body:", e);
    return new NextResponse("Failed to read body", { status: 400 });
  }

  // Validate signature and parse event
  try {
    event = stripe.webhooks.constructEvent(
      bodyBuffer,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err);
    return new NextResponse(`Webhook Error: ${err}`, { status: 400 });
  }

  // Now handle the event
  try {
    switch (event.type) {
      case "invoice.payment_succeeded": {
        // You can parse the invoice and see what user it belongs to
        // Possibly mark usage as paid or store references, etc.
        console.log("[Stripe Webhook] Payment succeeded:", event.data.object);
        break;
      }
      case "invoice.payment_failed": {
        console.log("[Stripe Webhook] Payment failed:", event.data.object);
        // Possibly mark user as delinquent or pause service
        break;
      }
      default:
        console.log("[Stripe Webhook] Unhandled event type:", event.type);
    }
    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("[Stripe Webhook] Error handling event:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 