import Stripe from "stripe";
import { db } from "@/db/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Initialize Stripe client
 * Make sure STRIPE_SECRET_KEY is in your .env
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2022-11-15"
});

/**
 * Record usage event for a user on a usage-based (metered) subscription item.
 * We assume the user has a 'stripeSubscriptionId' referencing a subscription with a metered price.
 */
export async function recordLeadUsage(userId: string) {
  // 1) Load the user from DB to get subscription ID
  const userRecord = await db.query.users.findFirst({
    where: eq(users.userId, userId)
  });
  if (!userRecord || !userRecord.stripeSubscriptionId) {
    throw new Error("User missing stripeSubscriptionId or not found.");
  }

  // 2) Retrieve subscription from Stripe to find the subscription item that has the metered price
  const subscription = await stripe.subscriptions.retrieve(userRecord.stripeSubscriptionId);

  // 3) We expect the usage-based price to match STRIPE_METERED_PRICE_ID in .env
  const meteredPriceId = process.env.STRIPE_METERED_PRICE_ID;
  if (!meteredPriceId) {
    throw new Error("No metered price ID set in environment (STRIPE_METERED_PRICE_ID).");
  }

  // 4) Find the subscription item that references that price
  const item = subscription.items.data.find(
    (i) => i.price && i.price.id === meteredPriceId
  );
  if (!item) {
    throw new Error("No subscription item with the metered price found on subscription.");
  }

  // 5) Create a usage record
  await stripe.subscriptionItems.createUsageRecord(item.id, {
    action: "increment",
    quantity: 1,
    timestamp: Math.floor(Date.now() / 1000)
  });
} 