"use server"

import { supabase } from "../../db/supabase";
import { BusinessInfo } from "../../lib/test-scrape-system";

interface BusinessProfileData {
  business_name?: string;
  website_url: string;
  owner_name?: string;
  owner_title?: string;
  owner_linkedin?: string;
  owner_email?: string;
  primary_email?: string;
  alternative_emails?: string[];
  phone_number?: string;
  address?: string;
  unique_selling_points?: string[];
  specialties?: string[];
  awards?: string[];
  year_established?: string;
  services?: string[];
  technologies?: string[];
  insurances_accepted?: string[];
  certifications?: string[];
  affiliations?: string[];
  testimonial_highlights?: string[];
  social_media_links?: Record<string, string>;
  source_url?: string;
  source_type?: string;
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
  try {
    // Check if profile exists
    const { data: existing } = await supabase
      .from('business_profiles')
      .select()
      .eq('website_url', websiteUrl)
      .limit(1);

    if (existing && existing.length > 0) {
      return {
        success: false,
        message: 'Business profile already exists',
        data: existing[0]
      };
    }

    // Extract and organize the data
    const profileData: BusinessProfileData = {
      business_name: scrapedInfo.name,
      website_url: websiteUrl,
      primary_email: scrapedInfo.email,
      phone_number: scrapedInfo.phone,
      address: scrapedInfo.address,
      specialties: scrapedInfo.specialties,
      services: scrapedInfo.services,
      insurances_accepted: scrapedInfo.insurances,
      affiliations: scrapedInfo.affiliations,
      social_media_links: scrapedInfo.socialLinks,
      unique_selling_points: extractUniqueSellingPoints(scrapedInfo),
      technologies: extractTechnologies(scrapedInfo),
      testimonial_highlights: extractTestimonials(scrapedInfo),
      source_url: sourceUrl,
      source_type: sourceType,
      notes: scrapedInfo.description
    };

    // Insert the profile
    const { data, error } = await supabase
      .from('business_profiles')
      .insert(profileData)
      .select()
      .limit(1);

    if (error) throw error;

    return {
      success: true,
      message: 'Business profile created successfully',
      data: data[0]
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
    const { data: updated, error } = await supabase
      .from('business_profiles')
      .update(data)
      .eq('website_url', websiteUrl)
      .select()
      .limit(1);

    if (error) throw error;

    return {
      success: true,
      message: 'Business profile updated successfully',
      data: updated[0]
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
    const { data, error } = await supabase
      .from('business_profiles')
      .select()
      .eq('website_url', websiteUrl)
      .limit(1);

    if (error) throw error;

    return {
      success: true,
      message: 'Business profile retrieved successfully',
      data: data[0] || null
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
    const { data, error } = await supabase
      .from('business_profiles')
      .select()
      .eq('outreach_status', 'pending')
      .limit(limit);

    if (error) throw error;

    return {
      success: true,
      message: 'Pending profiles retrieved successfully',
      data: data
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

    const emailHistory = profile.data.email_history || [];
    if (emailDetails) {
      emailHistory.push({
        ...emailDetails,
        sentAt: new Date().toISOString()
      });
    }

    const { data: updated, error } = await supabase
      .from('business_profiles')
      .update({
        outreach_status: status,
        last_email_sent_at: emailDetails ? new Date().toISOString() : undefined,
        email_history: emailHistory
      })
      .eq('website_url', websiteUrl)
      .select()
      .limit(1);

    if (error) throw error;

    return {
      success: true,
      message: 'Outreach status updated successfully',
      data: updated[0]
    };
  } catch (error) {
    console.error('Error updating outreach status:', error);
    return {
      success: false,
      message: 'Failed to update outreach status'
    };
  }
} 