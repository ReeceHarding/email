import 'dotenv/config';
import { db } from '../db';
import { leads } from '../db/schema';
import { desc } from 'drizzle-orm';

async function queryLeads() {
  console.log('Querying leads from database...\n');
  
  try {
    const results = await db
      .select()
      .from(leads)
      .orderBy(desc(leads.createdAt));
    
    console.log(`Found ${results.length} leads:\n`);
    
    results.forEach((lead, index) => {
      console.log(`Lead ${index + 1}: ${lead.companyName}`);
      console.log('ID:', lead.id);
      console.log('Website:', lead.websiteUrl);
      console.log('Status:', lead.status);
      
      // Basic Info
      if (lead.description) console.log('Description:', lead.description);
      
      // Contact Info
      if (lead.contactName) console.log('Contact Name:', lead.contactName);
      if (lead.contactEmail) console.log('Contact Email:', lead.contactEmail);
      if (lead.phoneNumber) console.log('Phone:', lead.phoneNumber);
      if (lead.address) console.log('Address:', lead.address);
      
      // Social Media
      if (lead.linkedinUrl) console.log('LinkedIn:', lead.linkedinUrl);
      if (lead.twitterUrl) console.log('Twitter:', lead.twitterUrl);
      if (lead.facebookUrl) console.log('Facebook:', lead.facebookUrl);
      if (lead.instagramUrl) console.log('Instagram:', lead.instagramUrl);
      
      // Business Hours
      if (lead.businessHours) console.log('Business Hours:', lead.businessHours);
      
      // Metadata
      console.log('Last Scraped:', lead.lastScrapedAt);
      console.log('Created At:', lead.createdAt);
      console.log('Updated At:', lead.updatedAt);
      console.log('-'.repeat(50), '\n');
    });
  } catch (error) {
    console.error('Error querying leads:', error);
  }
}

queryLeads().catch(console.error); 