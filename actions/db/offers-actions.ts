"use server"

import { db } from "@/db/db"
import { offersTable } from "@/db/schema/offers-schema"
import { eq } from "drizzle-orm"
import { ActionState } from "@/types"
import { InsertOffer, SelectOffer } from "@/db/schema/offers-schema"
import { draftEmailWithClaude } from "@/lib/ai"
import { sendGmail } from "@/lib/google"
import { getBusinessProfile } from "./business-profiles-actions"

/**
 * Creates a new offer in the DB. The user must supply `userId` & `businessProfileId`,
 * plus all other fields from InsertOffer. We store them and return the row.
 */
export async function createOfferAction(
  data: InsertOffer
): Promise<ActionState<SelectOffer>> {
  try {
    const [newOffer] = await db.insert(offersTable).values(data).returning()
    return {
      isSuccess: true,
      message: "Offer created successfully",
      data: newOffer
    }
  } catch (error) {
    console.error("[createOfferAction] Error creating offer:", error)
    return { isSuccess: false, message: "Failed to create offer" }
  }
}

/**
 * Retrieves a single offer by ID
 */
export async function getOfferAction(
  offerId: string
): Promise<ActionState<SelectOffer>> {
  try {
    const result = await db.query.offersTable.findFirst({
      where: eq(offersTable.id, offerId)
    })
    if (!result) {
      return { isSuccess: false, message: "Offer not found" }
    }
    return {
      isSuccess: true,
      message: "Offer retrieved successfully",
      data: result
    }
  } catch (error) {
    console.error("[getOfferAction] Error reading offer:", error)
    return { isSuccess: false, message: "Failed to read offer" }
  }
}

/**
 * Updates an offer by ID
 */
export async function updateOfferAction(
  offerId: string,
  data: Partial<InsertOffer>
): Promise<ActionState<SelectOffer>> {
  try {
    const [updated] = await db
      .update(offersTable)
      .set(data)
      .where(eq(offersTable.id, offerId))
      .returning()
    if (!updated) {
      return { isSuccess: false, message: "Offer not found or not updated" }
    }
    return {
      isSuccess: true,
      message: "Offer updated successfully",
      data: updated
    }
  } catch (error) {
    console.error("[updateOfferAction] Error updating offer:", error)
    return { isSuccess: false, message: "Failed to update offer" }
  }
}

/**
 * This action drafts and sends an email using the user's custom Offer text combined with
 * the businessProfile's data (scraped from the site), then calls Gmail. 
 * `userClerkId` is the user's Clerk ID. 
 * `offerId` is the ID of the offer. 
 * `businessWebsiteUrl` is how we find the businessProfile data to tailor the email.
 */
export async function sendOfferEmailAction(
  userClerkId: string,
  offerId: string,
  businessWebsiteUrl: string
): Promise<ActionState<void>> {
  try {
    // 1) Retrieve the offer
    const offerResult = await getOfferAction(offerId)
    if (!offerResult.isSuccess || !offerResult.data) {
      return { isSuccess: false, message: "Offer not found" }
    }
    const offer = offerResult.data

    // 2) Retrieve the business profile
    const bizProfileResult = await getBusinessProfile(businessWebsiteUrl)
    if (!bizProfileResult.success || !bizProfileResult.data) {
      return { isSuccess: false, message: "Business profile not found" }
    }
    const bizProfile = bizProfileResult.data

    // 3) Combine the offer text with the business profile in an AI draft
    //    We'll pass in relevant data for context
    const promptData = {
      userOffer: {
        dreamOutcome: offer.dreamOutcome,
        perceivedLikelihood: offer.perceivedLikelihood,
        timeDelay: offer.timeDelay,
        effortAndSacrifice: offer.effortAndSacrifice,
        shortPitch: offer.shortPitch,
        businessProfile: {
          name: bizProfile.businessName,
          website: bizProfile.websiteUrl,
          notes: bizProfile.notes,
          uniqueSellingPoints: bizProfile.uniqueSellingPoints,
          outreachStatus: bizProfile.outreachStatus
        }
      }
    }

    // We call the existing draftEmailWithClaude function
    const { subject, body } = await draftEmailWithClaude(promptData)
    if (!subject || !body) {
      return { isSuccess: false, message: "Failed to generate AI email draft" }
    }

    // 4) If the businessProfile has an email, we send
    const toEmail = bizProfile.primaryEmail || bizProfile.ownerEmail
    if (!toEmail) {
      return { isSuccess: false, message: "No email found on the business profile" }
    }

    // 5) Now we do the actual sending
    const { threadId, messageId } = await sendGmail({
      userClerkId,
      to: toEmail,
      subject,
      body
    })

    console.log("[sendOfferEmailAction] Email sent. threadId=", threadId, "messageId=", messageId)
    return {
      isSuccess: true,
      message: "Email sent successfully"
    }
  } catch (error) {
    console.error("[sendOfferEmailAction] Error:", error)
    return { isSuccess: false, message: "Failed to send Offer email" }
  }
} 