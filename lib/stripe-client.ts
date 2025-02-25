"use server"

import Stripe from 'stripe'

// Initialize Stripe
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

// For testing purposes
export async function setStripe(mockStripe: any) {
  Object.assign(stripe, mockStripe)
} 