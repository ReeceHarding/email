"use server"

import { db } from "../../db";
import { leads } from "../../db/schema";
import { ScrapedBusinessData } from "../../lib/firecrawl";
import { eq, and } from "drizzle-orm";

function mapScrapedDataToColumns(scrapedData: ScrapedBusinessData) {
  return {
    // Basic Info
    companyName: scrapedData.businessName,
    description: scrapedData.description,
    
    // Contact Info
    contactName: scrapedData.ownerName,
    contactEmail: scrapedData.contactEmail,
    phoneNumber: scrapedData.phoneNumber,
    address: scrapedData.address,
    
    // Social Media
    linkedinUrl: scrapedData.socialMedia?.linkedin || scrapedData.linkedin,
    twitterUrl: scrapedData.socialMedia?.twitter,
    facebookUrl: scrapedData.socialMedia?.facebook,
    instagramUrl: scrapedData.socialMedia?.instagram,
    
    // Business Hours
    businessHours: scrapedData.hours || null,
    
    // Store raw data for reference
    rawScrapedData: scrapedData,
    
    // Update metadata
    lastScrapedAt: new Date(),
    status: "scraped" as const
  };
}

export async function createLead(
  userId: string,
  websiteUrl: string,
  scrapedData: ScrapedBusinessData
) {
  try {
    // Check if lead already exists for this user and website
    const existingLead = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.userId, userId),
          eq(leads.websiteUrl, websiteUrl)
        )
      )
      .limit(1);

    const mappedData = mapScrapedDataToColumns(scrapedData);

    if (existingLead.length > 0) {
      // Update existing lead instead of creating a new one
      const [updatedLead] = await db
        .update(leads)
        .set({
          ...mappedData,
          updatedAt: new Date()
        })
        .where(eq(leads.id, existingLead[0].id))
        .returning();

      return {
        success: true,
        message: "Lead updated successfully",
        data: updatedLead,
      };
    }

    // Create new lead if it doesn't exist
    const [newLead] = await db
      .insert(leads)
      .values({
        userId,
        websiteUrl,
        ...mappedData
      })
      .returning();

    return {
      success: true,
      message: "Lead created successfully",
      data: newLead,
    };
  } catch (error) {
    console.error("Error creating/updating lead:", error);
    return {
      success: false,
      message: "Failed to create/update lead",
    };
  }
}

export async function getLeads(userId: string) {
  try {
    const userLeads = await db
      .select()
      .from(leads)
      .where(eq(leads.userId, userId))
      .orderBy(leads.updatedAt);

    return {
      success: true,
      message: "Leads retrieved successfully",
      data: userLeads,
    };
  } catch (error) {
    console.error("Error getting leads:", error);
    return {
      success: false,
      message: "Failed to get leads",
    };
  }
}

export async function updateLead(
  leadId: number,
  data: Partial<typeof leads.$inferInsert>
) {
  try {
    const [updatedLead] = await db
      .update(leads)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(leads.id, leadId))
      .returning();

    return {
      success: true,
      message: "Lead updated successfully",
      data: updatedLead,
    };
  } catch (error) {
    console.error("Error updating lead:", error);
    return {
      success: false,
      message: "Failed to update lead",
    };
  }
}

export async function deleteLead(leadId: number) {
  try {
    await db.delete(leads).where(eq(leads.id, leadId));

    return {
      success: true,
      message: "Lead deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting lead:", error);
    return {
      success: false,
      message: "Failed to delete lead",
    };
  }
} 