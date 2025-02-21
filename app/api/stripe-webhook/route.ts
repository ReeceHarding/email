"use server"

import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/db/db'
import { usersTable } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Initialize Stripe
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15'
})

// For testing purposes
export function setStripe(mockStripe: any) {
  Object.assign(stripe, mockStripe)
}

export async function POST(request: NextRequest) {
  try {
    // Get the signature from headers
    const signature = request.headers.get('stripe-signature')
    if (!signature) {
      return new Response('Missing Stripe signature header', { status: 400 })
    }

    // Get the raw body
    const body = await request.text()

    // Verify the event
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch (err) {
      console.error('Error verifying webhook signature:', err)
      return new Response('Invalid signature', { status: 400 })
    }

    // Handle different event types
    switch (event.type) {
      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.subscription) {
          // Update user's subscription status
          await db
            .update(usersTable)
            .set({
              stripeSubscriptionId: invoice.subscription as string,
              stripeCustomerId: invoice.customer as string
            })
            .where(eq(usersTable.stripeCustomerId, invoice.customer as string))
        }
        break

      case 'invoice.payment_failed':
        // Handle failed payment
        const failedInvoice = event.data.object as Stripe.Invoice
        console.error('Payment failed for invoice:', failedInvoice.id)
        // You might want to notify the user or take other actions
        break

      case 'customer.subscription.deleted':
        const subscription = event.data.object as Stripe.Subscription
        // Remove subscription info from user
        await db
          .update(usersTable)
          .set({
            stripeSubscriptionId: null
          })
          .where(eq(usersTable.stripeCustomerId, subscription.customer as string))
        break

      // Add other event types as needed
    }

    return new Response('Webhook processed', { status: 200 })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response('Webhook error', { status: 500 })
  }
} 