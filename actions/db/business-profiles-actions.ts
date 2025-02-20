"use server"

import { db } from "../../db/db";
import { businessProfiles } from "../../db/schema/outreach-schema";
import { eq } from "drizzle-orm";
import { BusinessInfo } from "../../lib/test-scrape-system";

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

  // Look for specific dental technologies
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
    /CBCT/i
  ];

  if (info.services) {
    info.services.forEach(service => {
      techPatterns.forEach(pattern => {
        const match = service.match(pattern);
        if (match) technologies.push(match[0]);
      });
    });
  }

  if (info.description) {
    techPatterns.forEach(pattern => {
      const match = info.description.match(pattern);
      if (match) technologies.push(match[0]);
    });
  }

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
  try {
    // Check if profile exists
    const existing = await db.select()
      .from(businessProfiles)
      .where(eq(businessProfiles.websiteUrl, websiteUrl))
      .limit(1);

    if (existing.length > 0) {
      return {
        success: false,
        message: 'Business profile already exists',
        data: existing[0]
      };
    }

    // Extract and organize the data
    const profileData: BusinessProfileData = {
      businessName: scrapedInfo.name,
      websiteUrl,
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
      sourceUrl,
      sourceType,
      notes: scrapedInfo.description
    };

    // Insert the profile
    const [newProfile] = await db.insert(businessProfiles)
      .values(profileData)
      .returning();

    return {
      success: true,
      message: 'Business profile created successfully',
      data: newProfile
    };
  } catch (error) {
    console.error('Error creating business profile:', error);
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
    const [updated] = await db.update(businessProfiles)
      .set(data)
      .where(eq(businessProfiles.websiteUrl, websiteUrl))
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
    const profile = await db.select()
      .from(businessProfiles)
      .where(eq(businessProfiles.websiteUrl, websiteUrl))
      .limit(1);

    return {
      success: true,
      message: 'Business profile retrieved successfully',
      data: profile[0] || null
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
    const profiles = await db.select()
      .from(businessProfiles)
      .where(eq(businessProfiles.outreachStatus, 'pending'))
      .limit(limit);

    return {
      success: true,
      message: 'Pending profiles retrieved successfully',
      data: profiles
    };
  } catch (error) {
    console.error('Error getting pending profiles:', error);
    return {
      success: false,
      message: 'Failed to get pending profiles'
    };
  }
}

export async function updateOutreachStatus(
  websiteUrl: string,
  status: string,
  emailDetails?: { subject: string; content: string }
) {
  try {
    const profile = await getBusinessProfile(websiteUrl);
    if (!profile.data) {
      return {
        success: false,
        message: 'Profile not found'
      };
    }

    const emailHistory = profile.data.emailHistory as Array<any> || [];
    if (emailDetails) {
      emailHistory.push({
        ...emailDetails,
        sentAt: new Date().toISOString()
      });
    }

    const [updated] = await db.update(businessProfiles)
      .set({
        outreachStatus: status,
        lastEmailSentAt: emailDetails ? new Date() : undefined,
        emailHistory: emailHistory
      })
      .where(eq(businessProfiles.websiteUrl, websiteUrl))
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