"use server"

import { NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe-client'
import { db } from '@/db/db'
import { usersTable } from '@/db/schema'
import { eq } from 'drizzle-orm'

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
    let event
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
        const invoice = event.data.object as any
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
        const failedInvoice = event.data.object as any
        console.error('Payment failed for invoice:', failedInvoice.id)
        // Remove subscription info from user
        await db
          .update(usersTable)
          .set({
            stripeSubscriptionId: null
          })
          .where(eq(usersTable.stripeCustomerId, failedInvoice.customer as string))
        break

      case 'customer.subscription.deleted':
        const subscription = event.data.object as any
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