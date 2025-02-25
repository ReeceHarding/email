"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createOfferAction, sendOfferEmailAction } from "@/actions/db/offers-actions"

/**
 * OffersBox
 * This component allows the user to:
 * 1) Input various fields of the Offer (just do dreamOutcome + shortPitch for brevity).
 * 2) Submit to createOfferAction.
 * 3) Optionally send an email to a sample business profile if user wants to.
 *
 * In real usage, you might have a list of businesses or a specific business to send to.
 */
export default function OffersBox({ userClerkId }: { userClerkId: string }) {
  const [dreamOutcome, setDreamOutcome] = useState("")
  const [shortPitch, setShortPitch] = useState("")
  const [loading, setLoading] = useState(false)
  const [createdOfferId, setCreatedOfferId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState("")

  async function handleCreateOffer() {
    try {
      setLoading(true)
      setFeedback("")
      const res = await createOfferAction({
        userId: userClerkId,
        businessProfileId: "00000000-0000-0000-0000-000000000000", // For demonstration
        dreamOutcome: dreamOutcome || "Placeholder dream outcome",
        perceivedLikelihood: "High",
        timeDelay: "Short",
        effortAndSacrifice: "Minimal",
        valueEquation: {
          likedFeatures: [],
          lackingFeatures: [],
          uniqueAdvantages: []
        },
        coreService: "Demo Service",
        bonuses: [],
        guarantee: "Satisfaction Guarantee",
        pricing: { amount: 500, currency: "USD" },
        scarcityElements: { type: "time", deadline: "2023-12-31" },
        shortPitch: shortPitch || "We'll help your business succeed easily",
        longPitch: "Longer version of the pitch. Expand on your offering details.",
        status: "draft",
        version: "1.0"
      })
      if (!res.isSuccess || !res.data) {
        setFeedback(`Offer creation failed: ${res.message}`)
      } else {
        setCreatedOfferId(res.data.id)
        setFeedback("Offer created successfully. You can now send it to a business.")
      }
    } catch (error: any) {
      console.error("handleCreateOffer error:", error)
      setFeedback("Failed to create offer: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSendEmail() {
    if (!createdOfferId) {
      setFeedback("No offer to send. Create an offer first.")
      return
    }
    try {
      setLoading(true)
      setFeedback("Sending email...")
      // For demonstration, send to a sample business website.
      // In real usage, you might let the user pick from a list or pass from props.
      const res = await sendOfferEmailAction(
        userClerkId,
        createdOfferId,
        "example-website.com" // Must exist in business_profiles
      )
      if (!res.isSuccess) {
        setFeedback(`Failed to send email: ${res.message}`)
      } else {
        setFeedback("Email sent successfully!")
      }
    } catch (error: any) {
      console.error("handleSendEmail error:", error)
      setFeedback("Error sending email: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 border rounded-md space-y-4 mt-8">
      <h2 className="font-semibold text-lg">Create an Offer</h2>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Dream Outcome</label>
        <input
          type="text"
          className="w-full border p-2 rounded"
          placeholder="Ex: 2x Your Revenue"
          value={dreamOutcome}
          onChange={e => setDreamOutcome(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Short Pitch</label>
        <textarea
          className="w-full border p-2 rounded"
          rows={4}
          placeholder="Ex: We'll handle all your marketing so you can focus on what you do best..."
          value={shortPitch}
          onChange={e => setShortPitch(e.target.value)}
        />
      </div>

      <button
        onClick={handleCreateOffer}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Offer"}
      </button>

      {createdOfferId && (
        <button
          onClick={handleSendEmail}
          disabled={loading}
          className="bg-green-600 text-white px-4 py-2 ml-2 rounded disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send Offer to Example Business"}
        </button>
      )}

      {feedback && (
        <div className="mt-4 text-sm text-gray-700">{feedback}</div>
      )}
    </div>
  )
} 