"use server"

import { db } from "../../db/db";
import { BusinessInfo } from "../../lib/test-scrape-system";
import { businessProfilesTable } from "../../db/schema/business-profiles-schema";
import { eq } from "drizzle-orm";

interface BusinessProfileData {
  businessName?: string;
  websiteUrl: string;
  ownerName?: string;
  ownerTitle?: string;
  ownerLinkedin?: string;
  ownerEmail?: string;
  primaryEmail?: string;
  alternativeEmails?: string[];
  phoneNumber?: string;
  address?: string;
  uniqueSellingPoints?: string[];
  specialties?: string[];
  awards?: string[];
  yearEstablished?: string;
  services?: string[];
  technologies?: string[];
  insurancesAccepted?: string[];
  certifications?: string[];
  affiliations?: string[];
  testimonialHighlights?: string[];
  socialMediaLinks?: Record<string, string>;
  sourceUrl?: string;
  sourceType?: string;
  notes?: string;
  emailHistory?: Array<{
    subject: string;
    content: string;
    sentAt: string;
  }>;
}

function extractUniqueSellingPoints(info: BusinessInfo): string[] {
  const sellingPoints: string[] = [];

  // Look for unique technologies or methods
  if (info.services) {
    const techMatches = info.services.filter(s => 
      s.toLowerCase().includes('state-of-the-art') ||
      s.toLowerCase().includes('latest') ||
      s.toLowerCase().includes('advanced') ||
      s.toLowerCase().includes('technology') ||
      s.toLowerCase().includes('cerec') ||
      s.toLowerCase().includes('digital')
    );
    sellingPoints.push(...techMatches);
  }

  // Look for experience indicators
  const description = info.description || '';
  const expMatches = description.match(/(?:over|more than)\s+\d+\s+years\s+(?:of\s+)?experience/gi);
  if (expMatches) sellingPoints.push(...expMatches);

  // Look for awards and recognitions
  if (info.affiliations) {
    const awardMatches = info.affiliations.filter(a =>
      a.toLowerCase().includes('award') ||
      a.toLowerCase().includes('recognition') ||
      a.toLowerCase().includes('certified') ||
      a.toLowerCase().includes('fellow')
    );
    sellingPoints.push(...awardMatches);
  }

  // Look for special certifications or training
  if (info.education) {
    const certMatches = info.education.filter(e =>
      e.toLowerCase().includes('specialist') ||
      e.toLowerCase().includes('advanced training') ||
      e.toLowerCase().includes('certification')
    );
    sellingPoints.push(...certMatches);
  }

  return [...new Set(sellingPoints)];
}

function extractTechnologies(info: BusinessInfo): string[] {
  const technologies: string[] = [];

  // Look for specific technologies
  const techPatterns = [
    /CEREC/i,
    /Digital X-rays?/i,
    /3D imaging/i,
    /CAD\/CAM/i,
    /Laser/i,
    /Intraoral camera/i,
    /Panoramic/i,
    /iTero/i,
    /Invisalign/i,
    /CBCT/i,
    // Add chiropractic-specific technologies
    /Activator/i,
    /ProAdjuster/i,
    /Flexion-Distraction/i,
    /Spinal Decompression/i,
    /Ultrasound/i,
    /Electrical Stimulation/i,
    /Cold Laser Therapy/i,
    /Traction/i
  ];

  if (info.services) {
    info.services.forEach(service => {
      techPatterns.forEach(pattern => {
        const match = service.match(pattern);
        if (match) technologies.push(match[0]);
      });
    });
  }

  const description = info.description || '';
  techPatterns.forEach(pattern => {
    const match = description.match(pattern);
    if (match) technologies.push(match[0]);
  });

  return [...new Set(technologies)];
}

function extractTestimonials(info: BusinessInfo): string[] {
  const testimonials: string[] = [];

  // Look for quoted text that looks like testimonials
  const testimonialPattern = /"[^"]{20,500}"/g;
  const quotePattern = /'[^']{20,500}'/g;

  if (info.description) {
    const matches = [
      ...(info.description.match(testimonialPattern) || []),
      ...(info.description.match(quotePattern) || [])
    ];
    
    testimonials.push(...matches.map(m => m.replace(/['"]/g, '').trim()));
  }

  return testimonials;
}

export async function createBusinessProfile(
  websiteUrl: string,
  scrapedInfo: BusinessInfo,
  sourceUrl?: string,
  sourceType: string = 'search'
): Promise<{ success: boolean; message: string; data?: any }> {
  console.log('[DB] Starting createBusinessProfile for:', websiteUrl);
  try {
    // Check if profile exists
    console.log('[DB] Checking for existing profile...');
    const existing = await db.query.businessProfiles.findFirst({
      where: eq(businessProfilesTable.websiteUrl, websiteUrl)
    });

    if (existing) {
      console.log('[DB] Profile already exists:', existing.id);
      return {
        success: false,
        message: 'Business profile already exists',
        data: existing
      };
    }

    // Extract and organize the data
    console.log('[DB] Preparing profile data...');
    const profileData = {
      businessName: scrapedInfo.name,
      websiteUrl: websiteUrl,
      primaryEmail: scrapedInfo.email,
      phoneNumber: scrapedInfo.phone,
      address: scrapedInfo.address,
      specialties: scrapedInfo.specialties,
      services: scrapedInfo.services,
      insurancesAccepted: scrapedInfo.insurances,
      affiliations: scrapedInfo.affiliations,
      socialMediaLinks: scrapedInfo.socialLinks,
      uniqueSellingPoints: extractUniqueSellingPoints(scrapedInfo),
      technologies: extractTechnologies(scrapedInfo),
      testimonialHighlights: extractTestimonials(scrapedInfo),
      sourceUrl: sourceUrl,
      sourceType: sourceType,
      notes: scrapedInfo.description
    };

    // Insert the profile
    console.log('[DB] Inserting new profile...');
    const [newProfile] = await db.insert(businessProfilesTable)
      .values(profileData)
      .returning();

    console.log('[DB] Profile created successfully:', newProfile.id);
    return {
      success: true,
      message: 'Business profile created successfully',
      data: newProfile
    };
  } catch (error) {
    console.error('[DB] Error creating business profile:', error);
    if (error instanceof Error) {
      console.error('[DB] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    return {
      success: false,
      message: 'Failed to create business profile'
    };
  }
}

export async function updateBusinessProfile(
  websiteUrl: string,
  data: Partial<BusinessProfileData>
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const [updated] = await db.update(businessProfilesTable)
      .set(data)
      .where(eq(businessProfilesTable.websiteUrl, websiteUrl))
      .returning();

    return {
      success: true,
      message: 'Business profile updated successfully',
      data: updated
    };
  } catch (error) {
    console.error('Error updating business profile:', error);
    return {
      success: false,
      message: 'Failed to update business profile'
    };
  }
}

export async function getBusinessProfile(websiteUrl: string) {
  try {
    const profile = await db.query.businessProfiles.findFirst({
      where: eq(businessProfilesTable.websiteUrl, websiteUrl)
    });

    return {
      success: true,
      message: 'Business profile retrieved successfully',
      data: profile
    };
  } catch (error) {
    console.error('Error getting business profile:', error);
    return {
      success: false,
      message: 'Failed to get business profile'
    };
  }
}

export async function getPendingOutreachProfiles(limit: number = 10) {
  try {
    const profiles = await db.query.businessProfiles.findMany({
      where: eq(businessProfilesTable.outreachStatus, 'pending'),
      limit: limit
    });

    return {
      success: true,
      message: 'Pending outreach profiles retrieved successfully',
      data: profiles
    };
  } catch (error) {
    console.error('Error getting pending outreach profiles:', error);
    return {
      success: false,
      message: 'Failed to get pending outreach profiles'
    };
  }
}

export async function updateOutreachStatus(
  websiteUrl: string,
  status: string,
  emailDetails?: {
    subject: string;
    content: string;
  }
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const profile = await getBusinessProfile(websiteUrl);
    if (!profile.success || !profile.data) {
      throw new Error('Profile not found');
    }

    const emailHistory = profile.data.emailHistory || [];
    if (emailDetails) {
      emailHistory.push({
        subject: emailDetails.subject,
        content: emailDetails.content,
        sentAt: new Date().toISOString()
      });
    }

    const [updated] = await db.update(businessProfilesTable)
      .set({
        outreachStatus: status,
        lastEmailSentAt: emailDetails ? new Date() : undefined,
        emailHistory: emailHistory
      })
      .where(eq(businessProfilesTable.websiteUrl, websiteUrl))
      .returning();

    return {
      success: true,
      message: 'Outreach status updated successfully',
      data: updated
    };
  } catch (error) {
    console.error('Error updating outreach status:', error);
    return {
      success: false,
      message: 'Failed to update outreach status'
    };
  }
} 